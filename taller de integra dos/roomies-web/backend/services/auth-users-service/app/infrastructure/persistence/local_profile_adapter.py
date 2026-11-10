"""Adaptador al contrato GET/PATCH existente para el entorno local v1."""
from app.domain.profile import RoomiesProfile,ProfileRuleViolation
from app.application.local_users import Users
from app.infrastructure.persistence.local_users import PostgresUsers


class LocalProfileAdapter:
    def __init__(self): self.users=Users(PostgresUsers())

    @staticmethod
    def profile(user):
        if user is None: return None
        return RoomiesProfile(id_usuario=user.id_usuario,supabase_user_id=user.supabase_user_id,nombre=user.nombre,
                             edad=user.age(),ocupacion=user.ocupacion,ciudad=user.ciudad,breve_descripcion=user.breve_descripcion,
                             sobre_mi=user.sobre_mi,foto_perfil=user.foto_perfil,verificado=None)

    def get_by_supabase_user_id(self,subject):
        return self.profile(self.users.repository.get(subject))

    def patch_by_supabase_user_id(self,subject,patch):
        user=self.users.repository.get(subject)
        if user is None: return None
        changes=patch.changes()
        if "edad" in changes and changes.pop("edad")!=user.age():
            raise ProfileRuleViolation("La edad se calcula desde la fecha de nacimiento.")
        return self.profile(self.users.update(subject,changes))

    def ensure_profile(self,subject,*,nombre,fecha_nacimiento):
        return self.profile(self.users.initialize(subject,nombre,fecha_nacimiento,True))
