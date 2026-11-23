"""D04 real Next/BFF/Gateway/Auth/Reportes/Listado/SQL; identidad HTTP ficticia."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
import time
from uuid import uuid4

import httpx


def exercise(base,gateway,identity,people,database):
    identity.users['c03-13@example.com']['user']['app_metadata']={'rol':'admin'}
    note='NOTA_INTERNA_D04_SOLO_ADMIN'
    def check(client,method,path,status=200,**kwargs):
        response=client.request(method,path,**kwargs)
        assert response.status_code==status,(method,path,response.status_code)
        return response
    with ExitStack() as stack:
        admin,reporter,owner=[stack.enter_context(httpx.Client(base_url=base,timeout=40,trust_env=False,headers={'Origin':base,'X-Haycupo-CSRF':'1'})) for _ in range(3)]
        for client,index in [(admin,13),(reporter,12),(owner,0)]:
            check(client,'POST','/web-api/auth/login',json={'correo':f'c03-{index}@example.com','contrasena':'Synthetic-password-123'})
        form={'titulo':'Publicacion para reportes D04','descripcion':'Solo SQL temporal','ubicacion':'Temuco','precio':'150000','cupos_totales':'1','tipo':'Arrendador','categoria':'ofrezco','tipo_vivienda':'habitacion','mascota':'no','id_region':'9','id_comuna':'9101'}
        publication=check(owner,'POST','/web-api/publicaciones',201,files=[(k,(None,v)) for k,v in form.items()],headers={'Idempotency-Key':str(uuid4())}).json()['id_publicacion']
        reports=[]
        for index in range(43):
            reports.append(check(reporter,'POST','/web-api/reportes',201,json={'id_publicacion_reportada':publication,'categoria':'Otro','descripcion':f'Reporte temporal D04 {index}'},headers={'Idempotency-Key':str(uuid4())}).json()['id_reporte'])
        seen=[];cursor=None
        while True:
            page=check(admin,'GET','/web-api/admin/reportes',params={'estado':'Pendiente','tipo':'Publicacion',**({'cursor':cursor} if cursor else {})}).json()
            seen.extend(row['id_reporte'] for row in page['items'])
            cursor=page['siguiente_cursor']
            if not cursor:break
        assert len(seen)==len(set(seen))==43
        id=reports[-1];path=f'/web-api/admin/reportes/{id}'
        check(reporter,'GET','/web-api/admin/reportes',403)
        check(reporter,'GET',path,403)
        check(reporter,'PATCH',path,403,json={'estado':'En_Revision','nota_interna':'Ajena'})
        check(admin,'GET','/admin/reportes')
        denied=check(reporter,'GET',f'/admin/reportes/{id}')
        assert note not in denied.text and 'no tiene permiso' in denied.text
        detail=check(admin,'PATCH',path,json={'estado':'En_Revision','nota_interna':note}).json()
        assert detail['historial'][-1]['id_administrador']==people[13]['business_id']
        assert detail['historial'][-1]['nota_interna']==note
        def decide(state):
            return admin.patch(path,json={'estado':state,'nota_interna':note+' final'})
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses=list(pool.map(decide,['Resuelto','Descartado']))
        assert sorted(r.status_code for r in responses)==[200,409]
        final=check(admin,'GET',path).json()
        assert final['estado'] in ('Resuelto','Descartado') and len(final['historial'])==2
        assert database.execute('SELECT count(*) FROM reportes.reporte_historial WHERE id_reporte=%s',(id,)).fetchone()[0]==2
        public=check(reporter,'GET','/web-api/reportes').json()
        found=next(row for row in public['items'] if row['id_reporte']==id)
        assert found['estado']==final['estado']
        assert note not in str(public) and 'historial' not in str(public) and 'id_denunciante' not in str(public)
        assert database.execute('SELECT estado FROM listado_applications.publicacion WHERE id_publicacion=%s',(publication,)).fetchone()[0]=='Disponible'
        identity.users['c03-13@example.com']['user']['app_metadata']={'rol':'usuario'}
        identity.users['c03-13@example.com']['user']['user_metadata']['rol']='admin'
        check(admin,'GET',path,403)
        denied=check(admin,'GET',f'/admin/reportes/{id}')
        assert note not in denied.text
        # Token firmado por el proveedor de laboratorio, pero ya expirado.
        expired=identity.session(identity.users['c03-13@example.com']['user'],exp=int(time.time())-60)['access_token']
        anonymous=stack.enter_context(httpx.Client(base_url=base,timeout=20,trust_env=False,cookies={'roomies_sb_dev_access':expired}))
        check(anonymous,'GET',path,401)
    print('PASS SCRUM-114: SQL real; 43 reportes paginados; bitacora; concurrencia 200/409; estado del reportante sin notas; rol app_metadata; URL/rol insuficiente/401. Identidad ficticia.',flush=True)
