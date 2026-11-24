
import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import "./Productos.css";

interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  precio: number;
  activo: boolean;
}

function Productos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("Pollos");
  const [precio, setPrecio] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // ESCUCHAR PRODUCTOS EN FIREBASE
  useEffect(() => {
    const consulta = query(
      collection(db, "productos"),
      orderBy("nombre", "asc")
    );

    const cancelar = onSnapshot(
      consulta,
      (snapshot) => {
        const lista = snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        })) as Producto[];

        setProductos(lista);
      },
      (error) => {
        console.error("Error al cargar productos:", error);
        alert("Error al cargar productos: " + error.message);
      }
    );

    return () => cancelar();
  }, []);

  // LIMPIAR FORMULARIO
  const limpiarFormulario = () => {
    setNombre("");
    setCategoria("Pollos");
    setPrecio("");
    setEditandoId(null);
  };

  // REGISTRAR O ACTUALIZAR PRODUCTO
  const guardarProducto = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (guardando) return;

    const nombreLimpio = nombre.trim();
    const precioNumerico = Number(precio);

    if (nombreLimpio.length === 0) {
      alert("Debes escribir el nombre del producto.");
      return;
    }

    if (!Number.isFinite(precioNumerico) || precioNumerico <= 0) {
      alert("Ingresa un precio válido mayor que cero.");
      return;
    }

    try {
      setGuardando(true);

      if (editandoId) {
        await updateDoc(doc(db, "productos", editandoId), {
          nombre: nombreLimpio,
          categoria,
          precio: precioNumerico,
        });

        alert("Producto actualizado correctamente.");
      } else {
        await addDoc(collection(db, "productos"), {
          nombre: nombreLimpio,
          categoria,
          precio: precioNumerico,
          activo: true,
          creadoEn: serverTimestamp(),
        });

        alert("Producto registrado correctamente.");
      }

      limpiarFormulario();

    } catch (error: any) {
      console.error("Error al guardar:", error);
      alert("Error al guardar producto: " + error.message);
    } finally {
      setGuardando(false);
    }
  };

  // EDITAR PRODUCTO
  const editarProducto = (producto: Producto) => {
    setNombre(producto.nombre);
    setCategoria(producto.categoria);
    setPrecio(String(producto.precio));
    setEditandoId(producto.id);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ELIMINAR PRODUCTO
  const eliminarProducto = async (id: string) => {
    const confirmar = window.confirm(
      "¿Deseas eliminar este producto?"
    );

    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, "productos", id));

      if (editandoId === id) {
        limpiarFormulario();
      }

      alert("Producto eliminado correctamente.");

    } catch (error: any) {
      console.error("Error al eliminar:", error);
      alert("No se pudo eliminar: " + error.message);
    }
  };

  // ACTIVAR O DESACTIVAR PRODUCTO
  const cambiarDisponibilidad = async (producto: Producto) => {
    try {
      await updateDoc(doc(db, "productos", producto.id), {
        activo: !producto.activo,
      });

    } catch (error: any) {
      console.error("Error al cambiar disponibilidad:", error);
      alert("No se pudo cambiar el estado: " + error.message);
    }
  };

  return (
    <div className="productos-container">

      {/* ENCABEZADO */}
      <div className="productos-encabezado">
        <div>
          <h1>Gestión de Productos</h1>
          <p>Administra el menú de Pollería El Buen Sabor</p>
        </div>

        <div className="contador-productos">
          {productos.length} productos registrados
        </div>
      </div>

      <div className="productos-contenido">

        {/* FORMULARIO */}
        <section className="formulario-productos">

          <h2>
            {editandoId ? "Editar producto" : "Nuevo producto"}
          </h2>

          <form onSubmit={guardarProducto}>

            <label htmlFor="nombre-producto">
              Nombre del producto
            </label>

            <input
              id="nombre-producto"
              name="nombre"
              type="text"
              placeholder="Ej. Pollo entero"
              value={nombre}
              onChange={(evento) => {
                setNombre(evento.currentTarget.value);
              }}
              autoComplete="off"
              required
            />

            <label htmlFor="categoria-producto">
              Categoría
            </label>

            <select
              id="categoria-producto"
              name="categoria"
              value={categoria}
              onChange={(evento) =>
                setCategoria(evento.currentTarget.value)
              }
            >
              <option value="Pollos">Pollos</option>
              <option value="Bebidas">Bebidas</option>
              <option value="Parrillas">Parrillas</option>
              <option value="Complementos">Complementos</option>
              <option value="Otros">Otros</option>
            </select>

            <label htmlFor="precio-producto">
              Precio (S/)
            </label>

            <input
              id="precio-producto"
              name="precio"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Ej. 65.00"
              value={precio}
              onChange={(evento) =>
                setPrecio(evento.currentTarget.value)
              }
              required
            />

            <div className="acciones-formulario">

              <button
                type="submit"
                className="btn-guardar-producto"
                disabled={guardando}
              >
                {guardando
                  ? "Guardando..."
                  : editandoId
                    ? "Actualizar producto"
                    : "Registrar producto"}
              </button>

              {editandoId && (
                <button
                  type="button"
                  className="btn-cancelar-producto"
                  onClick={limpiarFormulario}
                >
                  Cancelar
                </button>
              )}

            </div>

          </form>
        </section>

        {/* LISTA DE PRODUCTOS */}
        <section className="lista-productos">

          <h2>Lista de productos</h2>

          {productos.length === 0 ? (
            <p className="productos-vacios">
              Todavía no hay productos registrados.
            </p>
          ) : (

            <div className="tabla-productos-contenedor">

              <table className="tabla-productos">

                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Precio</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>

                <tbody>

                  {productos.map((producto) => (

                    <tr key={producto.id}>

                      <td>{producto.nombre}</td>

                      <td>{producto.categoria}</td>

                      <td>
                        S/ {Number(producto.precio).toFixed(2)}
                      </td>

                      <td>
                        <span
                          className={
                            producto.activo
                              ? "estado-producto activo"
                              : "estado-producto inactivo"
                          }
                        >
                          {producto.activo
                            ? "Disponible"
                            : "Inactivo"}
                        </span>
                      </td>

                      <td>
                        <div className="acciones-tabla">

                          <button
                            type="button"
                            className="btn-editar-producto"
                            onClick={() => editarProducto(producto)}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className="btn-disponibilidad"
                            onClick={() =>
                              cambiarDisponibilidad(producto)
                            }
                          >
                            {producto.activo
                              ? "Desactivar"
                              : "Activar"}
                          </button>

                          <button
                            type="button"
                            className="btn-eliminar-producto"
                            onClick={() =>
                              eliminarProducto(producto.id)
                            }
                          >
                            Eliminar
                          </button>

                        </div>
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>
          )}

        </section>

      </div>
    </div>
  );
}

export default Productos;
