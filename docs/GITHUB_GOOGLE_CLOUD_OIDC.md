# Configuración de identidad GitHub → Google Cloud para Financia

Esta integración **no** conecta automáticamente Firebase a ChatGPT ni despliega la aplicación.
Permite que un workflow de GitHub Actions autorizado solicite credenciales temporales
de Google Cloud sin guardar una clave privada.

## Configuración prevista

- Proyecto Google Cloud: `financia-57085`
- Grupo Workload Identity: `financia-github`
- Proveedor OIDC: `github-actions` (confirmar ID real en Google Cloud)
- Emisor: `https://token.actions.githubusercontent.com`
- Mapeo: `google.subject = assertion.sub`
- Mapeo: `attribute.repository = assertion.repository`
- Condición: `assertion.repository == 'saestradaurrego-wq/Financia-'`

**El grupo existente por sí solo no autoriza acceso**. El proveedor debe
crearse correctamente, y debe existir una cuenta de servicio independiente
con permisos mínimos. No utilizar la cuenta `firebase-adminsdk` para CI.

## Pasos que requieren autorización del propietario

1. Verificar que el proveedor OIDC exista y esté habilitado.
2. Crear una cuenta de servicio nueva, por ejemplo `financia-github-ci`.
3. Otorgar a esa cuenta solo los roles requeridos por la tarea concreta.
   No asignar Owner, Editor ni Firebase Admin de forma general.
4. Conceder a la identidad del repositorio permiso de
   `roles/iam.workloadIdentityUser` sobre esa cuenta de servicio.
   Usar el principalSet del atributo repository del proveedor correcto.
5. Registrar en GitHub Actions Variables, no secretos, los identificadores
   no sensibles `GCP_WORKLOAD_IDENTITY_PROVIDER` y
   `GCP_SERVICE_ACCOUNT`. El primero debe tener el formato
   `projects/NUMERO_PROYECTO/locations/global/workloadIdentityPools/financia-github/providers/ID_PROVEEDOR`.
6. Probar primero un workflow de lectura de identidad; no desplegar ni
   modificar Firebase automáticamente hasta validar permisos y reglas.

## Seguridad

- Restringir el proveedor al repositorio correcto es necesario pero no
  suficiente: limitar también el acceso del workflow a ramas protegidas
  o entornos aprobados antes de conceder permisos de escritura.
- No copiar claves JSON, tokens de acceso ni credenciales al chat.
- GitHub OIDC solo funciona durante un workflow con
  `permissions: id-token: write`.
- El acceso al proyecto de Google Cloud no concede automáticamente acceso
  a Cloudflare Workers/D1; eso se configura por separado.
