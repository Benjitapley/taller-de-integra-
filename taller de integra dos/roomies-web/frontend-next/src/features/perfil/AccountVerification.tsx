"use client";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import VerificationForm from "@/features/auth/VerificationForm";
import styles from "./perfil.module.css";

export default function AccountVerification({ verified, onRefresh }: { verified: boolean | null; onRefresh: () => void }) {
  return <Card>
    <h2>Verificación de cuenta</h2>
    {verified === true ? <p className={styles.verified}>Correo verificado</p>
      : verified === false ? <>
        <p>Correo pendiente de verificación.</p>
        <p>Introduce el correo con el que registraste tu cuenta y el código recibido. Si necesitas otro código, usa «Reenviar código».</p>
        <VerificationForm onVerified={onRefresh} showFlowLinks={false} />
        <Button variant="secondary" className={styles.retry} onClick={onRefresh}>Ya verifiqué mi correo: actualizar estado</Button>
      </> : <>
        <p role="status">No se pudo determinar el estado de verificación del correo.</p>
        <Button variant="secondary" onClick={onRefresh}>Consultar estado de verificación</Button>
      </>}
    <p className={styles.description}>Verificar el correo demuestra el control del correo electrónico. No verifica tu identidad legal ni documentos.</p>
  </Card>;
}
