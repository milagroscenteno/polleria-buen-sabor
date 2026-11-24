
import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import "./Usuarios.css";

interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  telefono: string;
  rol: string;
  activo: boolean;
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [rol, setRol] = useState("Mozo");
  const [editando, setEditando] = useState<string | null>(null);

  useEffect(() => {
    const cancelar = onSnapshot(collection(db, "usuarios"), (snapshot) => {
      const lista = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      })) as Usuario[];

      setUsuarios(lista);
    });

    return () => cancelar();
  }, []);

  const limpiarFormulario = () => {
    setNombre("");
    setCorreo("");
    setTelefono("");
    setRol("Mozo");
    setEditando(null);
  };

  const guardarUsuario = async (evento: React.FormEvent) => {
    evento.preventDefault();

    if (!nombre.trim() || !correo.trim() || !telefono.trim()) {
      alert("Completa todos los campos.");
      return;
    }

    try {
      const datos = {
        nombre: nombre.trim(),
        correo: correo.trim(),
        telefono: telefono.trim(),
        rol,
      };

      if (editando) {
        await updateDoc(doc(db, "usuarios", editando), datos);
        alert("Usuario actualizado correctamente.");
      } else {
        await addDoc(collection(db, "usuarios"), {
          ...datos,
          activo: true,
          creadoEn: serverTimestamp(),
        });
        alert("Usuario registrado correctamente.");
      }

      limpiarFormulario();
    } catch (error) {
      console.error("Error al guardar usuario:", error);
      alert("No se pudo guardar el usuario.");
    }
  };

  const editarUsuario = (usuario: Usuario) => {
    setNombre(usuario.nombre);
    setCorreo(usuario.correo);
    setTelefono(usuario.telefono);
    setRol(usuario.rol);
    setEditando(usuario.id);
  };

  const cambiarEstado = async (usuario: Usuario) => {
    try {
      await updateDoc(doc(db, "usuarios", usuario.id), {
        activo: !usuario.activo,
      });
    } catch (error) {
      console.error("Error al cambiar estado:", error);
      alert("No se pudo cambiar el estado del usuario.");
    }
  };

  return (
    <div className="usuarios-contenedor">
      <div className="usuarios-encabezado">
        <div>
          <h1>Gestión de Usuarios</h1>
          <p>Administra el personal de Pollería El Buen Sabor</p>
        </div>
        <div className="usuarios-total">
          <strong>{usuarios.length}</strong>
          <span>Usuarios registrados</span>
        </div>
      </div>

      <div className="usuarios-panel">
        <h2>{editando ? "Editar usuario" : "Registrar nuevo usuario"}</h2>

        <form onSubmit={guardarUsuario} className="usuarios-formulario">
          <div className="usuario-campo">
            <label>Nombre completo</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ingrese el nombre"
            />
          </div>

          <div className="usuario-campo">
            <label>Correo electrónico</label>
            <input
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="ejemplo@correo.com"
            />
          </div>

          <div className="usuario-campo">
            <label>Teléfono</label>
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Número de teléfono"
            />
          </div>

          <div className="usuario-campo">
            <label>Rol del usuario</label>
            <select value={rol} onChange={(e) => setRol(e.target.value)}>
              <option value="Administrador">Administrador</option>
              <option value="Cajero">Cajero</option>
              <option value="Mozo">Mozo</option>
              <option value="Cocinero">Cocinero</option>
            </select>
          </div>

          <div className="usuarios-botones">
            <button type="submit" className="usuario-btn-guardar">
              {editando ? "Actualizar usuario" : "Registrar usuario"}
            </button>

            {editando && (
              <button
                type="button"
                className="usuario-btn-cancelar"
                onClick={limpiarFormulario}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="usuarios-panel">
        <h2>Lista de usuarios</h2>

        <div className="usuarios-tabla-contenedor">
          <table className="usuarios-tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Teléfono</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {usuarios.length === 0 ? (
                <tr>
                  <td colSpan={6} className="usuarios-vacio">
                    Todavía no hay usuarios registrados.
                  </td>
                </tr>
              ) : (
                usuarios.map((usuario) => (
                  <tr key={usuario.id}>
                    <td>{usuario.nombre}</td>
                    <td>{usuario.correo}</td>
                    <td>{usuario.telefono}</td>
                    <td>{usuario.rol}</td>
                    <td>
                      <span className={usuario.activo ? "estado-activo" : "estado-inactivo"}>
                        {usuario.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      <div className="usuario-acciones">
                        <button
                          className="usuario-btn-editar"
                          onClick={() => editarUsuario(usuario)}
                        >
                          Editar
                        </button>
                        <button
                          className="usuario-btn-estado"
                          onClick={() => cambiarEstado(usuario)}
                        >
                          {usuario.activo ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
