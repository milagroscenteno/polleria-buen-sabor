
import { useEffect, useState } from "react";

import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";

import { db, auth } from "./firebase";
import "./Pedidos.css";

interface Mesa {
  id: string;
  numero: number;
  estado: string;
  atencionActivaId: string | null;
}

interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  precio: number;
  activo: boolean;
}

interface ItemPedido {
  productoId: string;
  nombre: string;
  cantidad: number;
  precio: number;
  subtotal: number;
}

interface Pedido {
  id: string;
  numeroMesa: number;
  mesaId?: string;
  atencionActivaId: string;
  items: ItemPedido[];
  total: number;
  estado: string;
}

function obtenerEmoji(categoria: string) {
  switch (categoria) {
    case "Pollos":
      return "🍗";
    case "Bebidas":
      return "🥤";
    case "Parrillas":
      return "🥩";
    case "Complementos":
      return "🍟";
    case "Otros":
      return "🍽️";
    default:
      return "🍴";
  }
}

function Pedidos() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  const [mesaSeleccionada, setMesaSeleccionada] = useState("");
  const [categoria, setCategoria] = useState("Todos");

  const [carrito, setCarrito] = useState<Record<string, number>>({});

  const [cargando, setCargando] = useState(true);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  // ESCUCHAR MESAS EN TIEMPO REAL
  useEffect(() => {
    const cancelar = onSnapshot(
      collection(db, "mesas"),
      (snapshot) => {
        const lista = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Mesa[];

        lista.sort((a, b) => a.numero - b.numero);

        setMesas(lista);
        setCargando(false);
      },
      (error) => {
        console.error("Error al cargar mesas:", error);
        setMensaje("No se pudieron cargar las mesas.");
        setCargando(false);
      }
    );

    return () => cancelar();
  }, []);

  // ESCUCHAR PRODUCTOS DESDE FIREBASE
  useEffect(() => {
    const cancelar = onSnapshot(
      collection(db, "productos"),
      (snapshot) => {
        const lista = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Producto[];

        lista.sort((a, b) =>
          a.nombre.localeCompare(b.nombre)
        );

        setProductos(lista);
        setCargandoProductos(false);
      },
      (error) => {
        console.error("Error al cargar productos:", error);
        setMensaje("No se pudieron cargar los productos.");
        setCargandoProductos(false);
      }
    );

    return () => cancelar();
  }, []);

  // ESCUCHAR PEDIDOS EN TIEMPO REAL
  useEffect(() => {
    const cancelar = onSnapshot(
      collection(db, "pedidos"),
      (snapshot) => {
        const lista = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Pedido[];

        setPedidos(lista);
      },
      (error) => {
        console.error("Error al consultar pedidos:", error);
        setMensaje("No se pudieron consultar los pedidos.");
      }
    );

    return () => cancelar();
  }, []);

  // FILTRAR MESAS OCUPADAS
  const mesasOcupadas = mesas.filter(
    (mesa) =>
      mesa.estado === "ocupada" &&
      mesa.atencionActivaId
  );

  const mesaActual = mesas.find(
    (m) => m.id === mesaSeleccionada
  );

  // MOSTRAR SOLAMENTE PRODUCTOS DISPONIBLES
  const productosDisponibles = productos.filter(
    (producto) => producto.activo !== false
  );

  // OBTENER CATEGORÍAS REGISTRADAS
  const categorias = [
    "Todos",
    ...Array.from(
      new Set(productosDisponibles.map((p) => p.categoria))
    ).sort(),
  ];

  // FILTRAR PRODUCTOS POR CATEGORÍA
  const productosFiltrados = productosDisponibles.filter(
    (producto) =>
      categoria === "Todos" ||
      producto.categoria === categoria
  );

  // AGREGAR PRODUCTO AL CARRITO
  const agregarProducto = (producto: Producto) => {
    setCarrito((anterior) => ({
      ...anterior,
      [producto.id]: (anterior[producto.id] || 0) + 1,
    }));
  };

  // CAMBIAR CANTIDAD
  const cambiarCantidad = (
    id: string,
    cambio: number
  ) => {
    setCarrito((anterior) => {
      const nuevaCantidad =
        (anterior[id] || 0) + cambio;

      const nuevoCarrito = { ...anterior };

      if (nuevaCantidad <= 0) {
        delete nuevoCarrito[id];
      } else {
        nuevoCarrito[id] = nuevaCantidad;
      }

      return nuevoCarrito;
    });
  };

  // CONSTRUIR LOS PRODUCTOS DEL CARRITO
  const itemsCarrito: ItemPedido[] = productos
    .filter(
      (producto) =>
        (carrito[producto.id] || 0) > 0 &&
        producto.activo !== false
    )
    .map((producto) => ({
      productoId: producto.id,
      nombre: producto.nombre,
      cantidad: carrito[producto.id],
      precio: Number(producto.precio),
      subtotal:
        Number(producto.precio) * carrito[producto.id],
    }));

  // CALCULAR TOTAL
  const total = itemsCarrito.reduce(
    (suma, item) => suma + item.subtotal,
    0
  );

  // ENVIAR PEDIDO A FIREBASE
  const enviarPedido = async () => {
    if (!mesaActual || !mesaActual.atencionActivaId) {
      setMensaje(
        "Selecciona una mesa ocupada con atención activa."
      );
      return;
    }

    if (itemsCarrito.length === 0) {
      setMensaje("Agrega al menos un producto al pedido.");
      return;
    }

    try {
      setProcesando(true);
      setMensaje("");

      await addDoc(collection(db, "pedidos"), {
        numeroMesa: mesaActual.numero,
        mesaId: mesaActual.id,
        atencionActivaId: mesaActual.atencionActivaId,
        items: itemsCarrito,
        total,
        estado: "pendiente",
        mozoId: auth.currentUser?.uid ?? "usuario-demo",
        creadoEn: serverTimestamp(),
      });

      setCarrito({});

      setMensaje(
        `¡Pedido de la Mesa ${mesaActual.numero} enviado correctamente a cocina!`
      );
    } catch (error: any) {
      console.error("Error al enviar pedido:", error);

      setMensaje(
        "No se pudo enviar el pedido: " + error.message
      );
    } finally {
      setProcesando(false);
    }
  };

  // MARCAR PEDIDO COMO ENTREGADO
  const marcarPedidoEntregado = async (pedidoId: string) => {
    try {
      await updateDoc(doc(db, "pedidos", pedidoId), {
        estado: "entregado",
        entregadoEn: serverTimestamp(),
      });

      setMensaje(
        "¡Pedido marcado como entregado correctamente!"
      );
    } catch (error: any) {
      console.error("Error al entregar pedido:", error);

      setMensaje(
        "No se pudo actualizar el estado del pedido: " +
          error.message
      );
    }
  };

  // HISTORIAL DE PEDIDOS DE LA ATENCIÓN
  const pedidosMesa = pedidos.filter(
    (pedido) =>
      mesaActual &&
      pedido.atencionActivaId === mesaActual.atencionActivaId
  );

  return (
    <div className="pedidos-container">

      <div className="pedidos-titulo">
        <div>
          <h1>Gestión de pedidos</h1>
          <p>Registra los pedidos de tus clientes.</p>
        </div>
      </div>

      {mensaje && (
        <div className="mensaje-pedidos">
          {mensaje}
        </div>
      )}

      {/* SELECCIÓN DE MESA */}
      <div className="seleccion-mesa">

        <label htmlFor="mesaPedido">
          Seleccionar mesa ocupada:
        </label>

        <select
          id="mesaPedido"
          value={mesaSeleccionada}
          onChange={(e) => {
            setMesaSeleccionada(e.target.value);
            setCarrito({});
            setMensaje("");
          }}
        >
          <option value="">Selecciona una mesa</option>

          {mesasOcupadas.map((mesa) => (
            <option key={mesa.id} value={mesa.id}>
              Mesa {String(mesa.numero).padStart(2, "0")}
            </option>
          ))}
        </select>

        {cargando && <p>Cargando mesas...</p>}

        {!cargando && mesasOcupadas.length === 0 && (
          <p>
            No hay mesas ocupadas. Primero inicia una atención.
          </p>
        )}

      </div>

      {mesaActual && (
        <>
          <div className="mesa-pedido-info">
            <h2>Pedido de Mesa {mesaActual.numero}</h2>
            <span>Atención activa</span>
          </div>

          {/* CATEGORÍAS DINÁMICAS */}
          <div className="categorias-productos">
            {categorias.map((cat) => (
              <button
                type="button"
                key={cat}
                className={
                  categoria === cat ? "categoria-activa" : ""
                }
                onClick={() => setCategoria(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="pedidos-layout">

            {/* CATÁLOGO DE PRODUCTOS */}
            <section className="catalogo-productos">

              <h2>Menú de productos</h2>

              {cargandoProductos ? (
                <p>Cargando productos desde Firebase...</p>
              ) : productosDisponibles.length === 0 ? (
                <p>
                  No hay productos disponibles.
                  Registra productos en Gestión de Productos.
                </p>
              ) : productosFiltrados.length === 0 ? (
                <p>No hay productos en esta categoría.</p>
              ) : (
                <div className="productos-grid">

                  {productosFiltrados.map((producto) => (
                    <div
                      className="producto-card"
                      key={producto.id}
                    >

                      <div className="producto-emoji">
                        {obtenerEmoji(producto.categoria)}
                      </div>

                      <h3>{producto.nombre}</h3>

                      <p className="producto-precio">
                        S/ {Number(producto.precio).toFixed(2)}
                      </p>

                      <button
                        type="button"
                        onClick={() => agregarProducto(producto)}
                      >
                        + Agregar
                      </button>

                    </div>
                  ))}

                </div>
              )}

            </section>

            {/* CARRITO */}
            <aside className="carrito-pedidos">

              <h2>🛒 Pedido actual</h2>

              {itemsCarrito.length === 0 ? (
                <p className="carrito-vacio">
                  Todavía no agregaste productos.
                </p>
              ) : (
                itemsCarrito.map((item) => (
                  <div
                    className="item-carrito"
                    key={item.productoId}
                  >

                    <div>
                      <strong>{item.nombre}</strong>
                      <p>
                        S/ {item.precio.toFixed(2)} c/u
                      </p>
                    </div>

                    <div className="cantidad-controles">

                      <button
                        type="button"
                        onClick={() =>
                          cambiarCantidad(item.productoId, -1)
                        }
                      >
                        −
                      </button>

                      <span>{item.cantidad}</span>

                      <button
                        type="button"
                        onClick={() =>
                          cambiarCantidad(item.productoId, 1)
                        }
                      >
                        +
                      </button>

                    </div>

                    <strong>
                      S/ {item.subtotal.toFixed(2)}
                    </strong>

                  </div>
                ))
              )}

              <div className="total-pedido">
                <span>TOTAL</span>
                <strong>S/ {total.toFixed(2)}</strong>
              </div>

              <button
                type="button"
                className="btn-enviar-cocina"
                onClick={enviarPedido}
                disabled={
                  procesando ||
                  itemsCarrito.length === 0
                }
              >
                {procesando
                  ? "Enviando..."
                  : "Enviar pedido a cocina"}
              </button>

            </aside>

          </div>

          {/* HISTORIAL DE PEDIDOS */}
          <section className="historial-pedidos">

            <h2>Pedidos de esta atención</h2>

            {pedidosMesa.length === 0 ? (
              <p>
                Aún no hay pedidos registrados para esta mesa.
              </p>
            ) : (
              pedidosMesa.map((pedido) => (
                <div
                  className="pedido-registrado"
                  key={pedido.id}
                >

                  <div>
                    <strong>
                      Pedido #{pedido.id.slice(0, 6)}
                    </strong>

                    <p>
                      {pedido.items?.length || 0} productos diferentes
                    </p>
                  </div>

                  <strong>
                    S/ {Number(pedido.total).toFixed(2)}
                  </strong>

                  <div className="pedido-estado-acciones">
                    <span
                      className={`estado-pedido ${pedido.estado}`}
                    >
                      {pedido.estado}
                    </span>

                    {pedido.estado === "listo" && (
                      <button
                        type="button"
                        className="btn-marcar-entregado"
                        onClick={() =>
                          marcarPedidoEntregado(pedido.id)
                        }
                      >
                        Marcar como entregado
                      </button>
                    )}
                  </div>

                </div>
              ))
            )}

          </section>
        </>
      )}

    </div>
  );
}

export default Pedidos;
