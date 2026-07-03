import { gql } from '@apollo/client';

export const LOGIN_MUTATION = gql`
  mutation Login($username: String!, $password: String!) {
    login2fa(username: $username, password: $password) {
      success
      requires2fa
      setupRequired
      qrCode
      userId
      tempToken
      token
      error
    }
  }
`;

export const GET_ME = gql`
  query GetMe {
    me {
      id
      username
      firstName
      lastName
      email
      isActive
      isSuperuser
      permissionsList
      ambientesAsignados
      sessionInvalidatedAt
      groups {
        id
        name
      }
    }
  }
`;

export const GET_ALL_USERS = gql`
  query GetAllUsers {
    allUsers {
      id
      username
      firstName
      lastName
      email
      isActive
      dateJoined
      permissionsList
      directPermissionIds
      ambientesAsignados
      groups {
        id
        name
      }
    }
  }
`;

export const GET_ALL_GROUPS = gql`
  query GetAllGroups {
    allGroups {
      id
      name
      permissions {
        id
        codename
        name
      }
    }
  }
`;

export const GENERATE_RESET_CODE = gql`
  mutation GenerateResetCode($userId: ID!) {
    generateResetCode(userId: $userId) {
      success
      code
      error
    }
  }
`;

export const VERIFY_RESET_CODE = gql`
  mutation VerifyResetCode($username: String!, $code: String!) {
    verifyResetCode(username: $username, code: $code) {
      success
      error
    }
  }
`;

export const SET_NEW_PASSWORD = gql`
  mutation SetNewPassword($username: String!, $code: String!, $newPassword: String!) {
    setNewPassword(username: $username, code: $code, newPassword: $newPassword) {
      success
      error
    }
  }
`;

export const GET_ALL_BLOQUEOS = gql`
  query GetAllBloqueos($usuarioId: ID) {
    allBloqueos(usuarioId: $usuarioId) {
      id
      fechaBloq
      motivoBloq
      fechaDesbloq
      motivoDesbloq
      usuario {
        id
        username
        firstName
        lastName
      }
      usuarioDesbloqueo {
        id
        username
        firstName
        lastName
      }
      persona {
        id
        ci
        nombre
        apellido
        telefono
        email
        cargo
      }
    }
  }
`;

export const GET_ALL_BLOQUEOS_PAGINATED = gql`
  query GetAllBloqueosPaginated($page: Int, $pageSize: Int, $search: String, $usuarioId: ID, $fechaDesde: Date, $fechaHasta: Date) {
    allBloqueosPaginated(page: $page, pageSize: $pageSize, search: $search, usuarioId: $usuarioId, fechaDesde: $fechaDesde, fechaHasta: $fechaHasta) {
      items {
        id
        fechaBloq
        motivoBloq
        fechaDesbloq
        motivoDesbloq
        usuario {
          id
          username
          firstName
          lastName
        }
        usuarioDesbloqueo {
          id
          username
          firstName
          lastName
        }
        persona {
          id
          ci
          nombre
          apellido
          telefono
          email
          cargo
        }
      }
      totalCount
    }
  }
`;

export const CREAR_BLOQUEO = gql`
  mutation CrearBloqueo($personaId: ID!, $motivo: String) {
    crearBloqueo(personaId: $personaId, motivo: $motivo) {
      bloqueo {
        id
        fechaBloq
        motivoBloq
        usuario {
          id
          firstName
          lastName
        }
        persona {
          id
          ci
          nombre
          apellido
          telefono
          email
          cargo
        }
      }
      success
      error
    }
  }
`;

export const DESBLOQUEAR_PERSONA = gql`
  mutation DesbloquearPersona($bloqueoId: ID!, $motivoDesbloq: String) {
    desbloquearPersona(bloqueoId: $bloqueoId, motivoDesbloq: $motivoDesbloq) {
      bloqueo {
        id
        fechaDesbloq
        motivoBloq
        motivoDesbloq
        usuarioDesbloqueo {
          id
          firstName
          lastName
        }
        persona {
          id
          ci
          nombre
          apellido
          telefono
          email
          cargo
        }
      }
      success
      error
    }
  }
`;


export const GET_ALL_PERMISSIONS = gql`
  query GetAllPermissions {
    allPermissions {
      id
      codename
      name
      contentTypeModel
    }
  }
`;

export const CREATE_USER = gql`
  mutation CreateUser($username: String!, $password: String!, $firstName: String!, $lastName: String!, $email: String, $groupId: ID, $permissionIds: [ID]) {
    createUser(username: $username, password: $password, firstName: $firstName, lastName: $lastName, email: $email, groupId: $groupId, permissionIds: $permissionIds) {
      user {
        id
        username
        firstName
        lastName
        email
        isActive
        permissionsList
        groups {
          id
          name
        }
      }
      success
      error
    }
  }
`;

export const UPDATE_USER = gql`
  mutation UpdateUser($userId: ID!, $firstName: String, $lastName: String, $email: String, $isActive: Boolean, $groupId: ID, $permissionIds: [ID]) {
    updateUser(userId: $userId, firstName: $firstName, lastName: $lastName, email: $email, isActive: $isActive, groupId: $groupId, permissionIds: $permissionIds) {
      user {
        id
        username
        firstName
        lastName
        email
        isActive
        permissionsList
        groups {
          id
          name
        }
      }
      success
      error
    }
  }
`;

export const RESET_USER_2FA = gql`
  mutation ResetUser2FA($userId: ID!) {
    resetUser2fa(userId: $userId) {
      success
      error
    }
  }
`;

export const DELETE_USER = gql`
  mutation DeleteUser($userId: ID!) {
    deleteUser(userId: $userId) {
      success
      error
    }
  }
`;

export const FORZAR_CIERRE_SESION = gql`
  mutation ForzarCierreSesion($userId: ID!) {
    forzarCierreSesion(userId: $userId) {
      success
      error
    }
  }
`;

export const TOGGLE_BYPASS_2FA = gql`
  mutation ToggleBypass2FA($userId: ID!) {
    toggleBypass2fa(userId: $userId) {
      success
      enabled
      error
    }
  }
`;

export const GET_ALL_PERSONAS = gql`
  query GetAllPersonas {
    allPersonas {
      id
      ci
      nombre
      apellido
      telefono
      email
      direccion
      cargo
      tipoEntidad
    }
  }
`;

export const CREAR_PERSONA = gql`
  mutation CrearPersona($ci: String!, $nombre: String!, $apellido: String!, $telefono: String, $email: String, $direccion: String, $cargo: String, $tipoEntidad: String) {
    crearPersona(ci: $ci, nombre: $nombre, apellido: $apellido, telefono: $telefono, email: $email, direccion: $direccion, cargo: $cargo, tipoEntidad: $tipoEntidad) {
      persona {
        id
        ci
        nombre
        apellido
        telefono
        email
        direccion
        cargo
        tipoEntidad
      }
      success
      error
    }
  }
`;

export const ACTUALIZAR_PERSONA = gql`
  mutation ActualizarPersona($id: ID!, $ci: String, $nombre: String, $apellido: String, $telefono: String, $email: String, $direccion: String, $cargo: String, $tipoEntidad: String) {
    actualizarPersona(id: $id, ci: $ci, nombre: $nombre, apellido: $apellido, telefono: $telefono, email: $email, direccion: $direccion, cargo: $cargo, tipoEntidad: $tipoEntidad) {
      persona {
        id
        ci
        nombre
        apellido
        telefono
        email
        direccion
        cargo
        tipoEntidad
      }
      success
      error
    }
  }
`;

export const GET_ALL_AMBIENTES = gql`
  query GetAllAmbientes {
    allAmbientes {
      id
      nombre
      ubicacion
      descripcion
    }
  }
`;

export const GET_ALL_ESTANTES = gql`
  query GetAllEstantes {
    allEstantes {
      id
      codigo
      numero
      descripcion
      estado
      limitePisos
      ambiente {
        id
        nombre
      }
    }
  }
`;

export const GET_ALL_PISOS = gql`
  query GetAllPisos {
    allPisos {
      id
      nroFila
      descripcion
      estante {
        id
        codigo
        ambiente {
          id
          nombre
        }
      }
    }
  }
`;

export const GET_ALL_CARPETAS = gql`
  query GetAllCarpetas {
    allCarpetas {
      id
      descripcion
      fechaCrea
      estado
      piso {
        id
        nroFila
        estante {
          id
          codigo
          ambiente {
            id
            nombre
          }
        }
      }
    }
  }
`;

export const GET_CARPETAS_CON_DOCUMENTOS = gql`
  query GetCarpetasConDocumentos($ids: [ID]) {
    allCarpetas(ids: $ids) {
      id
      descripcion
      piso {
        id
        nroFila
        estante {
          id
          codigo
          ambiente {
            id
            nombre
          }
        }
      }
      documentos {
        id
        codigoDoc
        titulo
        tipoDoc
        fechaIngre
        estado
        isPrestadoIndividual
      }
    }
  }
`;

export const CREAR_AMBIENTE = gql`
  mutation CrearAmbiente($nombre: String!, $ubicacion: String, $descripcion: String) {
    crearAmbiente(nombre: $nombre, ubicacion: $ubicacion, descripcion: $descripcion) {
      ambiente {
        id
        nombre
        ubicacion
        descripcion
      }
      success
      error
    }
  }
`;

export const EDITAR_AMBIENTE = gql`
  mutation EditarAmbiente($id: ID!, $nombre: String, $ubicacion: String, $descripcion: String) {
    editarAmbiente(id: $id, nombre: $nombre, ubicacion: $ubicacion, descripcion: $descripcion) {
      ambiente {
        id
        nombre
        ubicacion
        descripcion
      }
      success
      error
    }
  }
`;

export const CREAR_ESTANTE = gql`
  mutation CrearEstante($codigo: String!, $idAmbiente: ID!, $numero: Int, $descripcion: String, $estado: String, $limitePisos: Int) {
    crearEstante(codigo: $codigo, idAmbiente: $idAmbiente, numero: $numero, descripcion: $descripcion, estado: $estado, limitePisos: $limitePisos) {
      estante {
        id
        codigo
        numero
        descripcion
        estado
        limitePisos
        ambiente {
          id
          nombre
        }
      }
      success
      error
    }
  }
`;

export const CREAR_PISO = gql`
  mutation CrearPiso($nroFila: Int!, $idEstante: ID!, $descripcion: String) {
    crearPiso(nroFila: $nroFila, idEstante: $idEstante, descripcion: $descripcion) {
      piso {
        id
        nroFila
        descripcion
        estante {
          id
          codigo
        }
      }
      success
      error
    }
  }
`;

export const CREAR_CARPETA = gql`
  mutation CrearCarpeta($descripcion: String!, $idPiso: ID!) {
    crearCarpeta(descripcion: $descripcion, idPiso: $idPiso) {
      carpeta {
        id
        descripcion
        fechaCrea
        estado
        piso {
          id
          nroFila
        }
      }
      success
      error
    }
  }
`;

export const EDITAR_ESTANTE = gql`
  mutation EditarEstante($id: ID!, $codigo: String, $numero: Int, $descripcion: String, $estado: String, $limitePisos: Int, $idAmbiente: ID) {
    editarEstante(id: $id, codigo: $codigo, numero: $numero, descripcion: $descripcion, estado: $estado, limitePisos: $limitePisos, idAmbiente: $idAmbiente) {
      estante {
        id
        codigo
        numero
        descripcion
        estado
        limitePisos
        ambiente {
          id
          nombre
        }
      }
      success
      error
    }
  }
`;

export const EDITAR_PISO = gql`
  mutation EditarPiso($id: ID!, $nroFila: Int, $descripcion: String, $idEstante: ID) {
    editarPiso(id: $id, nroFila: $nroFila, descripcion: $descripcion, idEstante: $idEstante) {
      piso {
        id
        nroFila
        descripcion
        estante {
          id
          codigo
        }
      }
      success
      error
    }
  }
`;

export const EDITAR_CARPETA = gql`
  mutation EditarCarpeta($id: ID!, $descripcion: String, $estado: String, $idPiso: ID) {
    editarCarpeta(id: $id, descripcion: $descripcion, estado: $estado, idPiso: $idPiso) {
      carpeta {
        id
        descripcion
        estado
        piso {
          id
          nroFila
        }
      }
      success
      error
    }
  }
`;

export const REGISTRAR_PRESTAMO = gql`
  mutation RegistrarPrestamo($idsCarpetas: [ID]!, $idPersona: ID!, $fechaDevolucion: Date!, $idAutorizadoPor: ID!, $observaciones: String) {
    registrarPrestamo(idsCarpetas: $idsCarpetas, idPersona: $idPersona, fechaDevolucion: $fechaDevolucion, idAutorizadoPor: $idAutorizadoPor, observaciones: $observaciones) {
      prestamo {
        id
        fechaPrest
        fechaDevolucion
        observaciones
        persona {
          id
          ci
          nombre
          apellido
        }
        usuario {
          id
          username
        }
        carpetas {
          id
          descripcion
        }
      }
      success
      error
      docsPrestadosIndividualmente
      warning
      tokenFirma
    }
  }
`;

export const REGISTRAR_DEVOLUCION = gql`
  mutation RegistrarDevolucion($idPrestamoCarpeta: ID!, $observaciones: String, $estadoDevolucion: String, $bloquearPersona: Boolean) {
    registrarDevolucion(idPrestamoCarpeta: $idPrestamoCarpeta, observaciones: $observaciones, estadoDevolucion: $estadoDevolucion, bloquearPersona: $bloquearPersona) {
      devolucion {
        id
        fechaDevol
        observaciones
        estadoDevolucion
        fotoFirma
        tokenFirma
        usuario {
          id
          username
        }
        prestamoCarpeta {
          id
          carpeta {
            id
            descripcion
          }
        }
      }
      success
      error
      tokenFirma
    }
  }
`;

export const GET_PRESTAMO_CARPETA = gql`
  query GetPrestamoCarpeta($id: ID!) {
    prestamoCarpeta(id: $id) {
      id
      estado
      devoluciones {
        id
        fechaDevol
        tokenFirma
        fotoFirma
        documentos {
          id
          documento {
            id
            titulo
          }
        }
      }
      fotoFirma
      tokenFirma
      totalCount
    }
  }
`;

export const REGISTRAR_DEVOLUCION_CON_DOCUMENTOS = gql`
  mutation RegistrarDevolucionConDocumentos($idPrestamoCarpeta: ID!, $idsDocumentosPresentes: [ID!]!, $diasProrroga: Int, $motivoProrroga: String) {
    registrarDevolucionConDocumentos(idPrestamoCarpeta: $idPrestamoCarpeta, idsDocumentosPresentes: $idsDocumentosPresentes, diasProrroga: $diasProrroga, motivoProrroga: $motivoProrroga) {
      devolucion {
        id
        fechaDevol
        estadoDevolucion
        documentos {
          id
          documento {
            id
            titulo
          }
          presente
        }
      }
      success
      error
      prorrogaCreada
      docsFaltantes
      mensaje
      tokenFirma
    }
  }
`;

export const GET_MIS_AMBIENTES = gql`
  query GetMisAmbientes {
    misAmbientes {
      id
      nombre
      ubicacion
      descripcion
    }
  }
`;

export const GET_ALL_TRASPASOS = gql`
  query GetAllTraspasos($usuarioId: ID) {
    allTraspasos(usuarioId: $usuarioId) {
      id
      fecha
      observaciones
      ubicado
      usuario {
        id
        username
        firstName
        lastName
      }
      ambienteOrigen {
        id
        nombre
      }
      ambienteDestino {
        id
        nombre
      }
      items {
        id
        ubicado
        pisoAsignado {
          id
          nroFila
          estante {
            codigo
          }
        }
        carpeta {
          id
          descripcion
          estado
        }
      }
    }
  }
`;

export const GET_TRASPASOS_PENDIENTES_PAGINATED = gql`
  query GetTraspasosPendientesPaginated($page: Int, $pageSize: Int, $ambienteId: ID, $search: String) {
    allTraspasosPendientesPaginated(page: $page, pageSize: $pageSize, ambienteId: $ambienteId, search: $search) {
      items {
        traspasoCarpetaId
        carpeta {
          id
          descripcion
          estado
        }
        traspaso {
          id
          fecha
          observaciones
          ambienteOrigen { id nombre }
          ambienteDestino { id nombre }
        }
      }
      totalCount
    }
  }
`;

export const ASIGNAR_AMBIENTES = gql`
  mutation AsignarAmbientes($usuarioId: ID!, $idsAmbientes: [ID]!) {
    asignarAmbientes(usuarioId: $usuarioId, idsAmbientes: $idsAmbientes) {
      success
      error
    }
  }
`;

export const REGISTRAR_TRASPASO = gql`
  mutation RegistrarTraspaso($idsCarpetas: [ID]!, $idAmbienteOrigen: ID!, $idAmbienteDestino: ID!, $observaciones: String) {
    registrarTraspaso(idsCarpetas: $idsCarpetas, idAmbienteOrigen: $idAmbienteOrigen, idAmbienteDestino: $idAmbienteDestino, observaciones: $observaciones) {
      traspaso {
        id
        fecha
      }
      success
      error
    }
  }
`;

export const UBICAR_CARPETAS = gql`
  mutation UbicarCarpetas($idsTraspasoCarpeta: [ID]!, $idPiso: ID!) {
    ubicarCarpetas(idsTraspasoCarpeta: $idsTraspasoCarpeta, idPiso: $idPiso) {
      success
      error
    }
  }
`;

export const GET_ALL_CARPETAS_DETALLE = gql`
  query GetAllCarpetasDetalle {
    allCarpetas {
      id
      descripcion
      fechaCrea
      estado
      piso {
        id
        nroFila
        descripcion
        estante {
          id
          codigo
          ambiente {
            id
            nombre
            ubicacion
          }
        }
      }
      documentos {
        id
        codigoDoc
        titulo
        tipoDoc
        fechaIngre
        propietario {
          id
          nombre
          apellido
          ci
          tipoEntidad
        }
      }
    }
  }
`;

export const CREAR_DOCUMENTO = gql`
  mutation CrearDocumento($codigoDoc: String, $titulo: String!, $tipoDoc: String!, $idCarpeta: ID!, $idPropietario: ID) {
    crearDocumento(codigoDoc: $codigoDoc, titulo: $titulo, tipoDoc: $tipoDoc, idCarpeta: $idCarpeta, idPropietario: $idPropietario) {
      documento {
        id
        codigoDoc
        titulo
        tipoDoc
        fechaIngre
        propietario {
          id
          nombre
          apellido
          tipoEntidad
        }
      }
      success
      error
    }
  }
`;

export const EDITAR_DOCUMENTO = gql`
  mutation EditarDocumento($id: ID!, $codigoDoc: String, $titulo: String, $tipoDoc: String, $idPropietario: ID) {
    editarDocumento(id: $id, codigoDoc: $codigoDoc, titulo: $titulo, tipoDoc: $tipoDoc, idPropietario: $idPropietario) {
      documento {
        id
        codigoDoc
        titulo
        tipoDoc
        propietario {
          id
          nombre
          apellido
          tipoEntidad
        }
      }
      success
      error
    }
  }
`;

export const GET_ALL_DEVOLUCIONES = gql`
  query GetAllDevoluciones($usuarioId: ID) {
    allDevoluciones(usuarioId: $usuarioId) {
      id
      fechaDevol
      observaciones
      usuario {
        id
        username
        firstName
        lastName
      }
      prestamoCarpeta {
        id
        carpeta {
          id
          descripcion
        }
      }
      estadoDevolucion
      fotoFirma
      tokenFirma
    }
  }
`;

export const GET_ALL_DEVOLUCIONES_PAGINATED = gql`
  query GetAllDevolucionesPaginated($page: Int, $pageSize: Int, $search: String, $usuarioId: ID, $fechaDesde: Date, $fechaHasta: Date) {
    allDevolucionesPaginated(page: $page, pageSize: $pageSize, search: $search, usuarioId: $usuarioId, fechaDesde: $fechaDesde, fechaHasta: $fechaHasta) {
      items {
        id
        fechaDevol
        observaciones
        estadoDevolucion
        tokenFirma
        fotoFirma
        usuario {
          id
          username
          firstName
          lastName
        }
        prestamoCarpeta {
          id
          carpeta {
            id
            descripcion
            piso {
              nroFila
              descripcion
              estante {
                codigo
                ambiente {
                  nombre
                }
              }
            }
          }
          prestamo {
            id
            fechaPrest
            fechaDevolucion
            observaciones
            persona {
              id
              nombre
              apellido
              ci
              telefono
              email
            }
            usuario {
              id
              username
              firstName
              lastName
            }
            autorizadoPor {
              id
              nombre
              apellido
              cargo
            }
          }
        }
      }
      totalCount
    }
  }
`;

export const GET_ALL_INCIDENTES = gql`
  query GetAllIncidentes($usuarioId: ID) {
    allIncidentes(usuarioId: $usuarioId) {
      id
      tipoInci
      fechaReporte
      estado
      usuario {
        id
        username
        firstName
        lastName
      }
      detalles {
        id
        descripcion
        carpeta {
          id
          descripcion
        }
      }
    }
  }
`;

export const GET_ALL_INCIDENTES_PAGINATED = gql`
  query GetAllIncidentesPaginated($page: Int, $pageSize: Int, $search: String, $usuarioId: ID, $fechaDesde: Date, $fechaHasta: Date) {
    allIncidentesPaginated(page: $page, pageSize: $pageSize, search: $search, usuarioId: $usuarioId, fechaDesde: $fechaDesde, fechaHasta: $fechaHasta) {
      items {
        id
        tipoInci
        fechaReporte
        estado
        usuario {
          id
          username
          firstName
          lastName
        }
detalles {
           id
           descripcion
           carpeta {
             id
             descripcion
             estado
             piso {
              id
              nroFila
              estante {
                id
                codigo
                ambiente {
                  id
                  nombre
                }
              }
            }
          }
        }
      }
      totalCount
    }
  }
`;

export const REGISTRAR_INCIDENTE = gql`
  mutation RegistrarIncidente($tipoInci: String!, $carpetaIds: [ID]!, $descripcion: String) {
    crearIncidente(tipoInci: $tipoInci, carpetaIds: $carpetaIds, descripcion: $descripcion) {
      incidente {
        id
        tipoInci
        fechaReporte
        estado
        usuario {
          id
          username
        }
      }
      success
      error
    }
  }
`;

export const RESOLVER_INCIDENTE = gql`
  mutation ResolverIncidente($incidenteId: ID!, $accion: String) {
    resolverIncidente(incidenteId: $incidenteId, accion: $accion) {
      success
      error
    }
  }
`;

export const RESOLVER_CARPETAS = gql`
  mutation ResolverCarpetas($carpetaIds: [ID!]!) {
    resolverCarpetas(carpetaIds: $carpetaIds) {
      success
      error
    }
  }
`;

export const GET_DASHBOARD_STATS = gql`
  query GetDashboardStats {
    dashboardStats {
      totalCarpetas
      prestamosActivos
      prestamosVencidosCount
      carpetasDisponibles
      personasCount
      traspasosPendientes
      incidentesActivos
      carpetasPorAmbiente {
        ambienteId
        ambienteNombre
        count
      }
      prestamosRecientes {
        id
        fechaPrest
        fechaDevolucion
        observaciones
        persona {
          id
          ci
          nombre
          apellido
        }
        usuario {
          id
          username
          firstName
          lastName
        }
        carpetas {
          id
          descripcion
          estado
        }
        prestamoCarpetas {
          id
          estado
          fechaDevol
        }
      }
      prestamosPorVencer {
        id
        fechaPrest
        fechaDevolucion
        persona {
          id
          nombre
          apellido
        }
        carpetas {
          id
          descripcion
        }
      }
      devolucionesRecientes {
        id
        fechaDevol
        observaciones
        usuario {
          id
          username
          firstName
          lastName
        }
        prestamoCarpeta {
          id
          carpeta {
            id
            descripcion
          }
        }
      }
    }
  }
`;

export const GET_NOTIFICATIONS = gql`
  query GetNotifications {
    notifications {
      id
      tipo
      mensaje
      link
      fecha
      leido
    }
  }
`;

export const MARCAR_NOTIFICACIONES_LEIDAS = gql`
  mutation MarcarNotificacionesLeidas($ids: [ID!]!) {
    marcarNotificacionesLeidas(ids: $ids) {
      success
      error
    }
  }
`;

export const GLOBAL_SEARCH = gql`
  query GlobalSearch($query: String!) {
    globalSearch(query: $query) {
      carpetas {
        id
        descripcion
        fechaCrea
        estado
        piso {
          id
          nroFila
          estante {
            id
            codigo
            ambiente {
              id
              nombre
            }
          }
        }
        prestamoInfo {
          prestada
          personaId
          personaNombre
          fechaPrest
          fechaDevolucion
          diasRestantes
        }
      }
      personas {
        id
        ci
        nombre
        apellido
        telefono
        email
        prestamosInfo {
          totalPendientesCarpetas
          itemsCarpetas {
            prestamoCarpetaId
            carpetaDescripcion
            fechaPrest
            fechaDevolucion
            diasRetraso
          }
          totalPendientesDocumentos
          itemsDocumentos {
            prestamoDocItemId
            documentoDescripcion
            fechaPrest
            fechaDevolucion
            diasRetraso
          }
          bloqueoActivo {
            id
            fechaBloq
            motivoBloq
          }
        }
      }
      documentos {
        id
        codigoDoc
        titulo
        tipoDoc
        fechaIngre
        carpeta {
          id
          descripcion
        }
      }
    }
  }
`;

export const GET_ALL_CARPETAS_PAGINATED = gql`
  query GetAllCarpetasPaginated($page: Int, $pageSize: Int, $ambienteId: ID, $search: String, $fechaDesde: Date, $fechaHasta: Date, $estado: String) {
    allCarpetasPaginated(page: $page, pageSize: $pageSize, ambienteId: $ambienteId, search: $search, fechaDesde: $fechaDesde, fechaHasta: $fechaHasta, estado: $estado) {
      items {
        id
        descripcion
        fechaCrea
        estado
        piso {
          id
          nroFila
          descripcion
          estante {
            id
            codigo
            ambiente {
              id
              nombre
              ubicacion
            }
          }
        }
        documentos {
          id
          codigoDoc
          titulo
          tipoDoc
          fechaIngre
          propietario {
            id
            nombre
            apellido
            ci
            tipoEntidad
          }
        }
      }
      totalCount
    }
  }
`;

export const GET_ALL_CARPETAS_SIMPLE_PAGINATED = gql`
  query GetAllCarpetasSimplePaginated($page: Int, $pageSize: Int, $ambienteId: ID) {
    allCarpetasPaginated(page: $page, pageSize: $pageSize, ambienteId: $ambienteId) {
      items {
        id
        descripcion
        fechaCrea
        estado
        piso {
          id
          nroFila
          estante {
            id
            codigo
            ambiente {
              id
              nombre
            }
          }
        }
      }
      totalCount
    }
  }
`;

export const GET_ALL_DOCUMENTOS = gql`
  query GetAllDocumentos($search: String) {
    allDocumentos(search: $search) {
      id
      codigoDoc
      titulo
      tipoDoc
      fechaIngre
      carpeta {
        id
        descripcion
      }
    }
  }
`;

export const GET_ALL_PERSONAS_PAGINATED = gql`
  query GetAllPersonasPaginated($page: Int, $pageSize: Int, $search: String) {
    allPersonasPaginated(page: $page, pageSize: $pageSize, search: $search) {
      items {
        id
        ci
        nombre
        apellido
        telefono
        email
        direccion
        cargo
        tipoEntidad
        bloqueoActivo {
          id
          fechaBloq
          motivoBloq
        }
      }
      totalCount
    }
  }
`;

export const GET_ALL_PRESTAMOS_PAGINATED = gql`
  query GetAllPrestamosPaginated($page: Int, $pageSize: Int, $search: String, $usuarioId: ID, $fechaDesde: Date, $fechaHasta: Date) {
    allPrestamosPaginated(page: $page, pageSize: $pageSize, search: $search, usuarioId: $usuarioId, fechaDesde: $fechaDesde, fechaHasta: $fechaHasta) {
      items {
        id
        fechaPrest
        fechaDevolucion
        observaciones
        persona {
          id
          ci
          nombre
          apellido
          telefono
          email
        }
        usuario {
          id
          username
          firstName
          lastName
        }
        autorizadoPor {
          id
          nombre
          apellido
          cargo
        }
        carpetas {
          id
          descripcion
          estado
        }
        prestamoCarpetas {
          id
          estado
          carpeta {
            id
            descripcion
          }
        }
      }
      totalCount
    }
  }
`;

export const GET_PRESTAMO_CARPETAS_PAGINATED = gql`
  query GetPrestamoCarpetasPaginated($prestamoId: ID!, $page: Int, $pageSize: Int) {
    prestamoCarpetasPaginated(prestamoId: $prestamoId, page: $page, pageSize: $pageSize) {
      items {
        id
        estado
        fechaDevol
        observaciones
        carpeta {
          id
          descripcion
          estado
          piso {
            id
            nroFila
            descripcion
            estante {
              id
              codigo
              ambiente {
                id
                nombre
              }
            }
          }
        }
      }
      totalCount
    }
  }
`;

export const GET_ALL_PRESTAMOS_VENCIDOS_PAGINATED = gql`
  query GetAllPrestamosVencidosPaginated($page: Int, $pageSize: Int) {
    allPrestamosVencidosPaginated(page: $page, pageSize: $pageSize) {
      items {
        id
        fechaPrest
        fechaDevolucion
        persona {
          id
          ci
          nombre
          apellido
          telefono
          email
        }
        carpetas {
          id
          descripcion
        }
        prestamoCarpetas {
          id
          estado
          carpeta {
            id
            descripcion
          }
        }
      }
      totalCount
    }
  }
`;

export const GET_ALL_PRESTAMOS_ACTIVOS_PAGINATED = gql`
  query GetAllPrestamosActivosPaginated($page: Int, $pageSize: Int, $search: String) {
    allPrestamosActivosPaginated(page: $page, pageSize: $pageSize, search: $search) {
      items {
        id
        fechaPrest
        fechaDevolucion
        persona {
          id
          nombre
          apellido
        }
        prestamoCarpetas {
          id
          estado
          carpeta {
            id
            descripcion
          }
        }
      }
      totalCount
    }
  }
`;

export const GET_ALL_TRASPASOS_PAGINATED = gql`
  query GetAllTraspasosPaginated($page: Int, $pageSize: Int, $search: String, $usuarioId: ID, $fechaDesde: Date, $fechaHasta: Date) {
    allTraspasosPaginated(page: $page, pageSize: $pageSize, search: $search, usuarioId: $usuarioId, fechaDesde: $fechaDesde, fechaHasta: $fechaHasta) {
      items {
        id
        fecha
        observaciones
        ubicado
        usuario {
          id
          username
          firstName
          lastName
        }
        ambienteOrigen {
          id
          nombre
        }
        ambienteDestino {
          id
          nombre
        }
        items {
          id
          ubicado
          pisoAsignado {
            id
            nroFila
            estante {
              codigo
            }
          }
          carpeta {
            id
            descripcion
            estado
          }
        }
      }
      totalCount
    }
  }
`;

export const GET_ALL_USERS_PAGINATED = gql`
  query GetAllUsersPaginated($page: Int, $pageSize: Int, $search: String) {
    allUsersPaginated(page: $page, pageSize: $pageSize, search: $search) {
      items {
        id
        username
        firstName
        lastName
        email
        isActive
        dateJoined
        permissionsList
        directPermissionIds
        ambientesAsignados
        bypass2faHasta
        groups {
          id
          name
        }
      }
      totalCount
    }
  }
`;

export const GET_ALL_PRESTAMOS = gql`
  query GetAllPrestamos($usuarioId: ID) {
    allPrestamos(usuarioId: $usuarioId) {
      id
      fechaPrest
      fechaDevolucion
      observaciones
      persona {
        id
        ci
        nombre
        apellido
        telefono
        email
        direccion
      }
      usuario {
        id
        username
        firstName
        lastName
      }
      autorizadoPor {
        id
        ci
        nombre
        apellido
        cargo
      }
      carpetas {
        id
        descripcion
        estado
        piso {
          id
          nroFila
          descripcion
          estante {
            id
            codigo
            ambiente {
              id
              nombre
            }
          }
        }
      }
      prestamoCarpetas {
        id
        estado
        fechaDevol
        observaciones
        carpeta {
          id
          descripcion
          estado
        }
      }
    }
  }
`;

export const GET_ALL_PRORROGAS_PAGINATED = gql`
  query GetAllProrrogasPaginated($page: Int, $pageSize: Int, $search: String, $usuarioId: ID, $fechaDesde: Date, $fechaHasta: Date) {
    allProrrogasPaginated(page: $page, pageSize: $pageSize, search: $search, usuarioId: $usuarioId, fechaDesde: $fechaDesde, fechaHasta: $fechaHasta) {
      items {
        id
        fechaRegistro
        diasOtorgados
        motivo
        usuario {
          id
          username
          firstName
          lastName
        }
        personaSolicita {
          id
          nombre
          apellido
          ci
        }
        prestamo {
          id
          fechaPrest
          fechaDevolucion
          persona {
            id
            nombre
            apellido
            ci
          }
        }
      }
      totalCount
    }
  }
`;

export const ACTUALIZAR_PERFIL = gql`
  mutation ActualizarPerfil($firstName: String, $lastName: String, $currentPassword: String, $newPassword: String) {
    actualizarPerfil(firstName: $firstName, lastName: $lastName, currentPassword: $currentPassword, newPassword: $newPassword) {
      user {
        id
        firstName
        lastName
      }
      success
      error
    }
  }
`;

export const REGISTRAR_PRORROGA = gql`
  mutation RegistrarProrroga($prestamoId: ID!, $personaSolicitaId: ID!, $diasOtorgados: Int!, $motivo: String) {
    registrarProrroga(prestamoId: $prestamoId, personaSolicitaId: $personaSolicitaId, diasOtorgados: $diasOtorgados, motivo: $motivo) {
      prorroga {
        id
        fechaRegistro
        diasOtorgados
      }
      success
      error
    }
  }
`;

export const REGISTRAR_PRESTAMO_DOC = gql`
  mutation RegistrarPrestamoDoc($idsDocumentos: [ID]!, $idPersona: ID!, $fechaDevolucion: Date!, $idAutorizadoPor: ID!, $observaciones: String) {
    registrarPrestamoDoc(idsDocumentos: $idsDocumentos, idPersona: $idPersona, fechaDevolucion: $fechaDevolucion, idAutorizadoPor: $idAutorizadoPor, observaciones: $observaciones) {
      prestamo {
        id
        fechaPrest
        fechaDevolucion
        observaciones
        persona { id ci nombre apellido }
        usuario { id username }
        items {
          id
          estado
          documento { id codigoDoc titulo tipoDoc }
        }
      }
      success
      error
      tokenFirma
    }
  }
`;

export const REGISTRAR_DEVOLUCION_DOC = gql`
  mutation RegistrarDevolucionDoc($idPrestamoDocItem: ID!, $observaciones: String, $estadoDevolucion: String, $bloquearPersona: Boolean) {
    registrarDevolucionDoc(idPrestamoDocItem: $idPrestamoDocItem, observaciones: $observaciones, estadoDevolucion: $estadoDevolucion, bloquearPersona: $bloquearPersona) {
      devolucion {
        id
        fechaDevol
        observaciones
        estadoDevolucion
        fotoFirma
        tokenFirma
        usuario { id username }
        prestamoDocItem {
          id
          documento { id codigoDoc titulo }
        }
      }
      success
      error
    }
  }
`;

export const REGISTRAR_PRORROGA_DOC = gql`
  mutation RegistrarProrrogaDoc($prestamoId: ID!, $personaSolicitaId: ID!, $diasOtorgados: Int!, $motivo: String) {
    registrarProrrogaDoc(prestamoId: $prestamoId, personaSolicitaId: $personaSolicitaId, diasOtorgados: $diasOtorgados, motivo: $motivo) {
      prorroga {
        id
        fechaRegistro
        diasOtorgados
      }
      success
      error
    }
  }
`;

export const GET_ALL_PRESTAMOS_DOC_PAGINATED = gql`
  query GetAllPrestamosDocPaginated($page: Int, $pageSize: Int, $search: String, $usuarioId: ID, $fechaDesde: Date, $fechaHasta: Date) {
    allPrestamosDocPaginated(page: $page, pageSize: $pageSize, search: $search, usuarioId: $usuarioId, fechaDesde: $fechaDesde, fechaHasta: $fechaHasta) {
      items {
        id
        fechaPrest
        fechaDevolucion
        observaciones
        persona { id ci nombre apellido telefono email }
        usuario { id username firstName lastName }
        autorizadoPor { id nombre apellido cargo }
        items {
          id
          estado
          fechaDevol
          documento { id codigoDoc titulo tipoDoc }
        }
        tokenFirma
        fotoFirma
      }
      totalCount
    }
  }
`;

export const GET_ALL_PRESTAMOS_DOC_VENCIDOS_PAGINATED = gql`
  query GetAllPrestamosDocVencidosPaginated($page: Int, $pageSize: Int) {
    allPrestamosDocVencidosPaginated(page: $page, pageSize: $pageSize) {
      items {
        id
        fechaPrest
        fechaDevolucion
        persona { id ci nombre apellido telefono email }
        items {
          id
          estado
          documento { id codigoDoc titulo }
        }
        tokenFirma
        fotoFirma
      }
      totalCount
    }
  }
`;

export const GET_ALL_PRESTAMOS_DOC_ACTIVOS_PAGINATED = gql`
  query GetAllPrestamosDocActivosPaginated($page: Int, $pageSize: Int) {
    allPrestamosDocActivosPaginated(page: $page, pageSize: $pageSize) {
      items {
        id
        fechaPrest
        fechaDevolucion
        persona { id nombre apellido }
        items {
          id
          estado
          documento { id codigoDoc titulo }
        }
        tokenFirma
        fotoFirma
      }
      totalCount
    }
  }
`;

export const GET_ALL_DEVOLUCIONES_DOC_PAGINATED = gql`
  query GetAllDevolucionesDocPaginated($page: Int, $pageSize: Int, $search: String, $usuarioId: ID, $fechaDesde: Date, $fechaHasta: Date) {
    allDevolucionesDocPaginated(page: $page, pageSize: $pageSize, search: $search, usuarioId: $usuarioId, fechaDesde: $fechaDesde, fechaHasta: $fechaHasta) {
      items {
        id
        fechaDevol
        observaciones
        estadoDevolucion
        prestamoDocItem {
          id
          documento { id codigoDoc titulo tipoDoc }
          prestamoDoc {
            id
            persona { id nombre apellido ci }
          }
        }
        usuario { id username firstName lastName }
      }
      totalCount
    }
  }
`;

export const GET_ALL_PRORROGAS_DOC_PAGINATED = gql`
  query GetAllProrrogasDocPaginated($page: Int, $pageSize: Int, $search: String, $usuarioId: ID, $fechaDesde: Date, $fechaHasta: Date) {
    allProrrogasDocPaginated(page: $page, pageSize: $pageSize, search: $search, usuarioId: $usuarioId, fechaDesde: $fechaDesde, fechaHasta: $fechaHasta) {
      items {
        id
        fechaRegistro
        diasOtorgados
        motivo
        prestamoDoc {
          id
          persona { id nombre apellido ci }
        }
        usuario { id username firstName lastName }
      }
      totalCount
    }
  }
`;

export const GET_PERSONA_PRESTAMOS_PENDIENTES = gql`
  query PersonaPrestamosPendientes($personaId: ID!) {
    personaPrestamosPendientes(personaId: $personaId) {
      totalPendientes
      items {
        prestamoCarpetaId
        carpetaDescripcion
        fechaPrest
        fechaDevolucion
        diasRetraso
      }
    }
  }
`;

export const GET_PERSONA_PRESTAMOS_DOC_PENDIENTES = gql`
  query PersonaPrestamosDocPendientes($personaId: ID!) {
    personaPrestamosDocPendientes(personaId: $personaId) {
      totalPendientes
      items {
        prestamoDocItemId
        documentoDescripcion
        fechaPrest
        fechaDevolucion
        diasRetraso
      }
    }
  }
`;

export const GET_PERSONA_PRESTAMOS_PAGINATED = gql`
  query PersonaPrestamosPaginated($personaId: ID!, $page: Int, $pageSize: Int) {
    allPrestamosPaginated(personaId: $personaId, page: $page, pageSize: $pageSize) {
      items {
        id
        fechaPrest
        fechaDevolucion
        observaciones
        prestamoCarpetas {
          id
          estado
          fechaDevol
          carpeta {
            id
            descripcion
            codigo
          }
        }
      }
      totalCount
    }
  }
`;

export const REGISTRAR_RETIRO = gql`
  mutation RegistrarRetiro($idCarpeta: ID!, $idPersona: ID!, $idAutorizadoPor: ID!, $motivo: String!, $motivoOtro: String, $observaciones: String) {
    registrarRetiro(idCarpeta: $idCarpeta, idPersona: $idPersona, idAutorizadoPor: $idAutorizadoPor, motivo: $motivo, motivoOtro: $motivoOtro, observaciones: $observaciones) {
      retiro {
        id
        carpeta { id descripcion estado piso { nroFila estante { codigo ambiente { nombre } } } }
        persona { id ci nombre apellido }
        autorizadoPor { id ci nombre apellido }
        usuario { id firstName lastName }
        fechaRetiro
        motivo
        motivoOtro
        observaciones
      }
      success
      error
    }
  }
`;

export const GET_ALL_RETIROS = gql`
  query GetAllRetiros($usuarioId: ID) {
    allRetiros(usuarioId: $usuarioId) {
      id
      carpeta { id descripcion piso { nroFila estante { codigo ambiente { nombre } } } }
      persona { id ci nombre apellido }
      autorizadoPor { id ci nombre apellido }
      usuario { id firstName lastName }
      fechaRetiro
      motivo
      motivoOtro
      observaciones
    }
  }
`;

export const GET_ALL_RETIROS_PAGINATED = gql`
  query GetAllRetirosPaginated($page: Int, $pageSize: Int, $search: String, $usuarioId: ID, $fechaDesde: Date, $fechaHasta: Date) {
    allRetirosPaginated(page: $page, pageSize: $pageSize, search: $search, usuarioId: $usuarioId, fechaDesde: $fechaDesde, fechaHasta: $fechaHasta) {
      items {
        id
        carpeta { id descripcion piso { nroFila estante { codigo ambiente { nombre } } } }
        persona { id ci nombre apellido }
        autorizadoPor { id ci nombre apellido }
        usuario { id firstName lastName }
        fechaRetiro
        motivo
        motivoOtro
        observaciones
      }
      totalCount
    }
  }
`;
