"""Next/BFF reales sobre los servicios y SQL efímeros de run_c03; sin dotenv."""
from contextlib import ExitStack
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
from uuid import uuid4
import httpx


def exercise(root, clean, identity, gateway, database, people, port):
    project = root / "frontend-next"
    isolated = Path(tempfile.mkdtemp(prefix=".proxy-test-112-", dir=project))
    node = shutil.which("node")
    if node is None:
        raise AssertionError("Falta Node para comprobar Next/BFF reales.")
    linked = False
    process = None
    try:
        for name in ("next.config.ts", "package.json", "tsconfig.json", "src", "public"):
            source = project / name
            if source.is_dir(): shutil.copytree(source, isolated / name)
            else: shutil.copy2(source, isolated / name)
        subprocess.run([node, "-e", "require('fs').symlinkSync(process.argv[1],process.argv[2],process.platform==='win32'?'junction':'dir')", str(project / "node_modules"), str(isolated / "node_modules")], check=True)
        linked = True
        base = f"http://127.0.0.1:{port}"
        env = {**clean, "NODE_ENV":"development", "NEXT_TELEMETRY_DISABLED":"1", "ROOMIES_LOCAL_MODE":"1",
               "ROOMIES_RUNTIME_MODE":"disposable", "WEB_AUTH_ENABLED":"true", "WEB_AUTH_PROVIDER":"supabase", "WEB_PROFILE_CONTRACT":"v1",
               "WEB_AUTH_ORIGIN":base, "WEB_AUTH_FASTAPI_ORIGIN":gateway, "FASTAPI_ORIGIN":gateway,
               "WEB_SUPABASE_ORIGIN":identity.origin, "WEB_SUPABASE_PUBLISHABLE_KEY":identity.publishable_key}
        with (isolated / "next.log").open("wb") as log, ExitStack() as clients:
            process = subprocess.Popen([node, str(project / "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", str(port)], cwd=isolated, env=env, stdin=subprocess.DEVNULL, stdout=log, stderr=log, creationflags=subprocess.CREATE_NO_WINDOW if os.name=="nt" else 0)
            owner, applicant, stranger = [clients.enter_context(httpx.Client(base_url=base,timeout=30,trust_env=False,headers={"Origin":base,"X-Haycupo-CSRF":"1"})) for _ in range(3)]
            for _ in range(100):
                if process.poll() is not None: raise AssertionError("No arrancó Next aislado: "+(isolated/"next.log").read_text(errors="replace")[-2000:])
                try:
                    if owner.get("/").status_code == 200: break
                except httpx.HTTPError: pass
                time.sleep(.3)
            else: raise AssertionError("Next no estuvo listo a tiempo.")

            def request(client,method,path,expected=(200,),**kwargs):
                response=client.request(method,path,**kwargs)
                assert response.status_code in expected,(method,path,response.status_code)
                return response

            for client,index in zip((owner,applicant,stranger),(11,12,13)):
                request(client,"POST","/web-api/auth/login",json={"correo":f"c03-{index}@example.com","contrasena":"Synthetic-password-123"})
                assert request(client,"GET","/web-api/auth/sesion").json()["authenticated"] is True
            # SCRUM-111: Next/BFF/Gateway/Auth/SQL reales, identidad y Storage HTTP ficticios.
            from io import BytesIO
            from PIL import Image
            content=BytesIO();Image.new("RGB",(2,2)).save(content,format="PNG")
            initial=request(owner,"GET","/web-api/perfil").json()
            assert initial["contrato_perfil"]=="v1"
            request(owner,"PATCH","/web-api/perfil",json={"ocupacion":"Trabajador","genero":"Otro","id_region_interes":9,"id_comuna_interes":9101})
            uploaded=request(owner,"PUT","/web-api/perfil/foto",files={"foto":("photo.png",content.getvalue(),"image/png")}).json()["foto_perfil"]
            previous=uploaded
            uploaded=request(owner,"PUT","/web-api/perfil/foto",files={"foto":("photo.png",content.getvalue(),"image/png")}).json()["foto_perfil"]
            assert uploaded != previous
            for _ in range(40):
                client_get=owner.get(previous)
                if client_get.status_code==404:break
                time.sleep(.2)
            else:raise AssertionError("La foto anterior no fue retirada")
            stale_access=owner.cookies.get("roomies_sb_dev_access")
            request(owner,"POST","/web-api/auth/logout",json={})
            with httpx.Client(base_url=base,timeout=30,trust_env=False,cookies={"roomies_sb_dev_access":stale_access}) as revoked:
                request(revoked,"GET","/web-api/perfil",(401,))
            request(owner,"POST","/web-api/auth/login",json={"correo":"c03-11@example.com","contrasena":"Synthetic-password-123"})
            assert request(owner,"GET","/web-api/perfil").json()["foto_perfil"]==uploaded
            request(owner,"PATCH","/web-api/perfil",(422,),json={"nombre":"Ajeno"})
            request(owner,"PATCH","/web-api/perfil",(422,),json={"id_comuna_interes":13101})
            request(stranger,"GET","/web-api/perfil")
            assert request(stranger,"GET","/web-api/perfil").json()["foto_perfil"]!=uploaded
            request(owner,"PATCH","/web-api/perfil",json={"genero":None,"sobre_mi":None})
            print("PASS SCRUM-111: rutas finales; PATCH; foto/logout/login; aislamiento; SQL real; identidad y Storage ficticios",flush=True)
            form={"titulo":"Arriendo D02 integrado","descripcion":"Prueba local con SQL efímero","ubicacion":"Temuco","precio":"150000","cupos_totales":"1","tipo":"Arrendador","categoria":"ofrezco","tipo_vivienda":"habitacion","mascota":"no","id_region":"9","id_comuna":"9101"}
            publication=request(owner,"POST","/web-api/publicaciones",(201,),files=[(k,(None,v)) for k,v in form.items()],headers={"Idempotency-Key":str(uuid4())}).json()["id_publicacion"]
            withdrawn=request(applicant,"POST","/web-api/postulaciones",(201,),json={"publicacion":publication}).json()["id_postulacion"]
            for _ in range(2):
                cancelled=request(applicant,"POST","/web-api/postulaciones",json={"retiro":withdrawn}).json()
                assert cancelled["estado"]=="Cancelada"
            application=request(applicant,"POST","/web-api/postulaciones",(201,),json={"publicacion":publication}).json()["id_postulacion"]
            rows=request(owner,"GET",f"/web-api/postulaciones?publicacion={publication}").json()
            assert rows["items"][0]["id_postulacion"]==application and rows["siguiente_cursor"] is None
            request(stranger,"PATCH","/web-api/postulaciones",(403,),json={"id":application,"estado":"Preseleccionada"})
            other=request(stranger,"POST","/web-api/postulaciones",(201,),json={"publicacion":publication}).json()["id_postulacion"]
            rejected=request(owner,"PATCH","/web-api/postulaciones",json={"id":other,"estado":"Rechazada","motivo":"Otra alternativa"}).json()
            assert rejected["estado"]=="Rechazada" and rejected["motivo"]=="Otra alternativa"
            request(owner,"PATCH","/web-api/postulaciones",json={"id":application,"estado":"Preseleccionada"})
            key=str(uuid4())
            request(owner,"PATCH","/web-api/postulaciones",(200,202),json={"id":application,"estado":"Aceptada"},headers={"Idempotency-Key":key})
            for _ in range(80):
                result=request(owner,"GET",f"/web-api/postulaciones/{application}").json()
                if result["estado"]=="Aceptada": break
                time.sleep(.25)
            else: raise AssertionError("No se confirmó la incorporación por BFF.")
            rental=request(applicant,"GET","/web-api/arriendos/mio").json()
            assert rental["id_arriendo"]==result["id_arriendo"] and rental["integrantes_activos"]==1 and rental["cupos_disponibles"]==0
            for _ in range(2):
                replay=request(owner,"PATCH","/web-api/postulaciones",json={"id":application,"estado":"Aceptada"},headers={"Idempotency-Key":key}).json()
                assert replay["id_arriendo"]==rental["id_arriendo"]
            assert database.execute("SELECT count(*) FROM convivencia_mensajeria.pertenencia WHERE id_usuario=%s AND estado='Activa'",(people[12]["business_id"],)).fetchone()[0]==1
            own=request(applicant,"GET","/web-api/postulaciones").json()["items"]
            assert own[0]["estado"]=="Aceptada" and own[0]["id_arriendo"]==rental["id_arriendo"]
            request(stranger,"GET",f"/web-api/postulaciones/{application}",(404,))
            request(stranger,"POST","/web-api/postulaciones",(409,),json={"publicacion":publication})
            print("PASS D02 web: tres sesiones; Next/BFF/Gateway/Auth/Listado/Convivencia reales; SQL temporal; proveedor de identidad simulado",flush=True)
    finally:
        if process is not None and process.poll() is None:
            if os.name=="nt":
                subprocess.run(["taskkill","/PID",str(process.pid),"/T","/F"],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=20)
            else:
                process.terminate()
            process.wait(timeout=20)
        if isolated.parent.resolve()!=project.resolve() or not isolated.name.startswith(".proxy-test-112-"):
            raise AssertionError("Ruta de limpieza inesperada.")
        if linked:
            if os.name=="nt": os.rmdir(isolated / "node_modules")
            else: (isolated / "node_modules").unlink()
        def cleanup_error(function,path,error):
            if not isinstance(error,FileNotFoundError): raise error
        shutil.rmtree(isolated,onexc=cleanup_error)
