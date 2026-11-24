
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  query,
  orderBy,
} from "firebase/firestore";

import { db } from "./firebase";
import "./Cocina.css";

interface ItemPedido {
  nombre: string;
  cantidad: number;
  precio: number;
  subtotal: number;
}

interface Pedido {
  id: string;
  numeroMesa: number;
  items: ItemPedido[];
  total: number;
  estado: string;
}

function Cocina() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState<string | null>(null);

  // ESCUCHAR PEDIDOS EN TIEMPO REAL
  useEffect(() => {
    const consulta = query(
      collection(db, "pedidos"),
      orderBy("creadoEn", "desc")
    );

    const cancelar = onSnapshot(
      consulta,
      (snapshot) => {
        const lista = snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        })) as Pedido[];

        setPedidos(lista);
        setCargando(false);
      },
      (error) => {
        console.error("Error al obtener pedidos:", error);
        alert("No se pudieron cargar los pedidos: " + error.message);
        setCargando(false);
      }
    );

    return () => cancelar();
  }, []);

  // ACTUALIZAR ESTADO DEL PEDIDO
  const cambiarEstado = async (
    id: string,
    nuevoEstado: string
  ) => {
    try {
      setActualizando(id);

      await updateDoc(doc(db, "pedidos", id), {
        estado: nuevoEstado,
      });

      console.log("Pedido actualizado:", nuevoEstado);

    } catch (error: any) {
      console.error("Error al actualizar pedido:", error);

      alert(
        "No se pudo actualizar el pedido.\n\n" +
        (error.message || "Error desconocido")
      );
    } finally {
      setActualizando(null);
    }
  };

  // SEPARAR PEDIDOS POR ESTADO
  const pendientes = pedidos.filter(
    (pedido) => pedido.estado === "pendiente"
  );

  const preparando = pedidos.filter(
    (pedido) => pedido.estado === "preparando"
  );

  const listos = pedidos.filter(
    (pedido) => pedido.estado === "listo"
  );

  const entregados = pedidos.filter(
    (pedido) => pedido.estado === "entregado"
  );

  // MOSTRAR TARJETAS DE PEDIDOS
  const mostrarPedidos = (
    lista: Pedido[],
    titulo: string
  ) => (
    <section className="columna-cocina">
      <h2>
        {titulo} ({lista.length})
      </h2>

      {lista.length === 0 && (
        <p className="sin-pedidos">
          No hay pedidos.
        </p>
      )}

      {lista.map((pedido) => (
        <article
          className="tarjeta-cocina"
          key={pedido.id}
        >
          <h3>Mesa {pedido.numeroMesa}</h3>

          <ul>
            {pedido.items?.map((item, index) => (
              <li key={index}>
                <strong>{item.cantidad}x</strong>{" "}
                {item.nombre}
              </li>
            ))}
          </ul>

          <p className="total-cocina">
            Total: S/ {Number(pedido.total).toFixed(2)}
          </p>

          {/* PEDIDO PENDIENTE */}
          {pedido.estado === "pendiente" && (
            <button
              className="btn-preparar"
              disabled={actualizando === pedido.id}
              onClick={() =>
                cambiarEstado(pedido.id, "preparando")
              }
            >
              {actualizando === pedido.id
                ? "Actualizando..."
                : "Iniciar preparación"}
            </button>
          )}

          {/* PEDIDO EN PREPARACIÓN */}
          {pedido.estado === "preparando" && (
            <button
              className="btn-listo"
              disabled={actualizando === pedido.id}
              onClick={() =>
                cambiarEstado(pedido.id, "listo")
              }
            >
              {actualizando === pedido.id
                ? "Actualizando..."
                : "Marcar como listo"}
            </button>
          )}

          {/* PEDIDO LISTO */}
          {pedido.estado === "listo" && (
            <button
              className="btn-entregado"
              disabled={actualizando === pedido.id}
              onClick={() =>
                cambiarEstado(pedido.id, "entregado")
              }
            >
              {actualizando === pedido.id
                ? "Actualizando..."
                : "Marcar como entregado"}
            </button>
          )}

          {/* PEDIDO ENTREGADO */}
          {pedido.estado === "entregado" && (
            <div className="acciones-entregado">
              <p className="mensaje-entregado">
                ✓ Pedido entregado
              </p>

              <button
                type="button"
                className="btn-regresar-preparacion"
                disabled={actualizando === pedido.id}
                onClick={() =>
                  cambiarEstado(pedido.id, "preparando")
                }
              >
                {actualizando === pedido.id
                  ? "Actualizando..."
                  : "↩ Regresar a preparación"}
              </button>
            </div>
          )}
        </article>
      ))}
    </section>
  );

  return (
    <div className="cocina-container">

      <div className="encabezado-cocina">
        <h1>Panel de Cocina</h1>
        <p>Control de pedidos en tiempo real</p>
      </div>

      {/* RESUMEN DE PEDIDOS */}
      <div className="resumen-cocina">

        <div>
          <span>Pendientes</span>
          <strong>{pendientes.length}</strong>
        </div>

        <div>
          <span>En preparación</span>
          <strong>{preparando.length}</strong>
        </div>

        <div>
          <span>Listos</span>
          <strong>{listos.length}</strong>
        </div>

        <div>
          <span>Entregados</span>
          <strong>{entregados.length}</strong>
        </div>

      </div>

      {/* TABLERO DE COCINA */}
      {cargando ? (
        <p>Cargando pedidos...</p>
      ) : (
        <div className="tablero-cocina">
          {mostrarPedidos(pendientes, "Pendientes")}
          {mostrarPedidos(preparando, "En preparación")}
          {mostrarPedidos(listos, "Listos")}
          {mostrarPedidos(entregados, "Entregados")}
        </div>
      )}

    </div>
  );
}

export default Cocina;
