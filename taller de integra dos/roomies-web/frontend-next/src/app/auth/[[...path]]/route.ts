// Retire the old browser passthrough without exposing the server JWT contract.
// FastAPI /auth/* remains available for trusted server-to-server consumers.
function retired() {
  return Response.json({ detail: "Usa /web-api/auth/ para la autenticación web segura." }, {
    status: 410, headers: { "Cache-Control": "no-store" },
  });
}
export { retired as GET, retired as POST, retired as PUT, retired as DELETE, retired as PATCH };
