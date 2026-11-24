
import { useEffect, useState } from "react";

import {
  collection,
  onSnapshot,
  doc,
  query,
  orderBy,
  where,
  getDocs,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "./firebase";
import "./Ventas.css";

interface ItemVenta {
  productoId?: string;
  nombre: string;
  cantidad: number;
  precio: number;
  subtotal: number;
}

interface Pedido {
  id: string;
  numeroMesa: number;
  mesaId?: string;
  atencionActivaId?: string;
  items: ItemVenta[];
  total: number;
  estado: string;
  ventaId?: string;
  cobrado?: boolean;
}

interface Venta {
  id: string;
  pedidoId: string;
  numeroMesa: number;
  mesaId?: string;
  atencionActivaId?: string;
  items: ItemVenta[];
  total: number;
  metodoPago: string;
  creadoEn?: any;
}

function Ventas() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [cargando, setCargando] = useState(true);

  const [metodosPago, setMetodosPago] = useState<
    Record<string, string>
  >({});

  const [procesando, setProcesando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");

  // ==========================================
  // ESCUCHAR PEDIDOS EN TIEMPO REAL
  // ==========================================
  useEffect(() => {
    const cancelar = onSnapshot(
      collection(db, "pedidos"),
      (snapshot) => {
        const lista = snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        })) as Pedido[];

        setPedidos(lista);
        setCargando(false);
      },
      (error) => {
        console.error("Error al cargar pedidos:", error);
        setMensaje("No se pudieron cargar los pedidos.");
        setCargando(false);
      }
    );

    return () => cancelar();
  }, []);

  // ==========================================
  // ESCUCHAR VENTAS EN TIEMPO REAL
  // ==========================================
  useEffect(() => {
    const consulta = query(
      collection(db, "ventas"),
      orderBy("creadoEn", "desc")
    );

    const cancelar = onSnapshot(
      consulta,
      (snapshot) => {
        const lista = snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        })) as Venta[];

        setVentas(lista);
      },
      (error) => {
        console.error("Error al cargar ventas:", error);
        setMensaje("No se pudo cargar el historial de ventas.");
      }
    );

    return () => cancelar();
  }, []);

  // ==========================================
  // PEDIDOS ENTREGADOS PENDIENTES DE COBRO
  // ==========================================
  const pedidosPorCobrar = pedidos.filter(
    (pedido) =>
      pedido.estado === "entregado" &&
      !pedido.ventaId &&
      pedido.cobrado !== true
  );

  // ==========================================
  // CAMBIAR MÉTODO DE PAGO
  // ==========================================
  const cambiarMetodoPago = (
    pedidoId: string,
    metodo: string
  ) => {
    setMetodosPago((anterior) => ({
      ...anterior,
      [pedidoId]: metodo,
    }));
  };

  // ==========================================
  // REGISTRAR COBRO, CERRAR ATENCIÓN
  // Y LIBERAR MESA
  // ==========================================
  const registrarVenta = async (pedido: Pedido) => {
    const metodoPago = metodosPago[pedido.id] || "Efectivo";

    try {
      setProcesando(pedido.id);
      setMensaje("");

      const pedidoRef = doc(db, "pedidos", pedido.id);
      const ventaRef = doc(collection(db, "ventas"));

      // ----------------------------------------
      // 1. CONSULTAR PEDIDOS DE LA MISMA ATENCIÓN
      // ----------------------------------------
      let referenciasPedidos: any[] = [];

      if (pedido.atencionActivaId) {
        const consultaPedidos = query(
          collection(db, "pedidos"),
          where(
            "atencionActivaId",
            "==",
            pedido.atencionActivaId
          )
        );

        const resultadoConsulta = await getDocs(consultaPedidos);

        referenciasPedidos = resultadoConsulta.docs.map(
          (documento) => doc(db, "pedidos", documento.id)
        );

        // Asegurar que el pedido actual esté incluido
        if (
          !referenciasPedidos.some(
            (referencia) => referencia.id === pedido.id
          )
        ) {
          referenciasPedidos.push(pedidoRef);
        }
      }

      // ----------------------------------------
      // 2. EJECUTAR TRANSACCIÓN
      // ----------------------------------------
      const resultado = await runTransaction(
        db,
        async (transaccion) => {

          // LEER EL PEDIDO ACTUAL
          const pedidoDoc = await transaccion.get(pedidoRef);

          if (!pedidoDoc.exists()) {
            throw new Error("El pedido ya no existe.");
          }

          const datosPedido = pedidoDoc.data();

          if (datosPedido.estado !== "entregado") {
            throw new Error(
              "Solo se pueden cobrar pedidos entregados."
            );
          }

          if (
            datosPedido.cobrado === true ||
            datosPedido.ventaId
          ) {
            throw new Error(
              "Este pedido ya tiene una venta registrada."
            );
          }

          const total = Number(datosPedido.total);

          if (!Number.isFinite(total) || total <= 0) {
            throw new Error("El total del pedido no es válido.");
          }

          const atencionId = datosPedido.atencionActivaId;

          let cerrarAtencion = false;
          let totalAtencion = 0;

          let atencionRef: any = null;
          let mesaRef: any = null;
          let mesaDoc: any = null;

          // ------------------------------------
          // 3. COMPROBAR TODOS LOS PEDIDOS
          // DE LA MISMA ATENCIÓN
          // ------------------------------------
          if (atencionId) {
            const documentosPedidos = await Promise.all(
              referenciasPedidos.map((referencia) =>
                transaccion.get(referencia)
              )
            );

            let todosCobrado = true;
            totalAtencion = 0;

            for (const documentoPedido of documentosPedidos) {
              if (!documentoPedido.exists()) {
                throw new Error(
                  "Uno de los pedidos de esta atención ya no existe. No se cerrará la mesa."
                );
              }

              const datos = documentoPedido.data();

              // El pedido actual se considera cobrado
              // porque se está registrando su cobro ahora.
              const yaCobrado =
                documentoPedido.id === pedido.id ||
                datos.cobrado === true ||
                Boolean(datos.ventaId);

              if (!yaCobrado) {
                todosCobrado = false;
              } else {
                totalAtencion += Number(datos.total || 0);
              }
            }

            cerrarAtencion = todosCobrado;

            // --------------------------------
            // 4. CONSULTAR ATENCIÓN
            // --------------------------------
            atencionRef = doc(
              db,
              "atenciones",
              atencionId
            );

            const atencionDoc = await transaccion.get(
              atencionRef
            );

            if (!atencionDoc.exists()) {
              throw new Error(
                "No se encontró la atención asociada al pedido."
              );
            }

            const datosAtencion = atencionDoc.data();

            // --------------------------------
            // 5. CONSULTAR MESA
            // --------------------------------
            const mesaId =
              datosAtencion.mesaId ||
              datosPedido.mesaId;

            if (mesaId) {
              mesaRef = doc(db, "mesas", mesaId);
              mesaDoc = await transaccion.get(mesaRef);
            }
          }

          // ------------------------------------
          // 6. REGISTRAR VENTA
          // ------------------------------------
          transaccion.set(ventaRef, {
            pedidoId: pedido.id,
            numeroMesa: datosPedido.numeroMesa,
            mesaId: datosPedido.mesaId || null,
            atencionActivaId: atencionId || null,
            items: datosPedido.items || [],
            total,
            metodoPago,
            estado: "pagada",
            creadoEn: serverTimestamp(),
          });

          // ------------------------------------
          // 7. MARCAR PEDIDO COMO COBRADO
          // ------------------------------------
          transaccion.update(pedidoRef, {
            ventaId: ventaRef.id,
            cobrado: true,
            cobradoEn: serverTimestamp(),
          });

          // ------------------------------------
          // 8. CERRAR ATENCIÓN
          // SI TODOS SUS PEDIDOS ESTÁN COBRADOS
          // ------------------------------------
          if (cerrarAtencion && atencionRef) {
            transaccion.update(atencionRef, {
              estado: "cerrada",
              cierreEn: serverTimestamp(),
              total: totalAtencion,
            });

            // --------------------------------
            // 9. LIBERAR MESA
            // --------------------------------
            if (mesaRef && mesaDoc?.exists()) {
              const datosMesa = mesaDoc.data();

              // Solo liberar si sigue perteneciendo
              // a esta misma atención.
              if (
                datosMesa.atencionActivaId === atencionId
              ) {
                transaccion.update(mesaRef, {
                  estado: "libre",
                  atencionActivaId: null,
                });
              }
            }
          }

          return {
            cerrada: cerrarAtencion,
            tieneAtencion: Boolean(atencionId),
          };
        }
      );

      // ----------------------------------------
      // 10. MENSAJES DE RESULTADO
      // ----------------------------------------
      if (resultado.cerrada) {
        setMensaje(
          `¡Cobro registrado correctamente! La atención de la Mesa ${pedido.numeroMesa} se cerró y la mesa quedó libre.`
        );
      } else if (!resultado.tieneAtencion) {
        setMensaje(
          "Cobro registrado, pero el pedido no tiene una atención asociada. No se pudo liberar automáticamente la mesa."
        );
      } else {
        setMensaje(
          `¡Cobro de la Mesa ${pedido.numeroMesa} registrado! Todavía existen otros pedidos pendientes de cobro en esta atención.`
        );
      }

    } catch (error: any) {
      console.error("Error al registrar venta:", error);

      setMensaje(
        error.message || "No se pudo registrar la venta."
      );

    } finally {
      setProcesando(null);
    }
  };

  // ==========================================
  // CALCULAR VENTAS DEL DÍA
  // ==========================================
  const ventasDelDia = ventas.filter((venta) => {
    if (!venta.creadoEn?.toDate) return false;

    const fechaVenta = venta.creadoEn.toDate();

    return (
      fechaVenta.toDateString() === new Date().toDateString()
    );
  });

  const totalDelDia = ventasDelDia.reduce(
    (suma, venta) => suma + Number(venta.total || 0),
    0
  );

  // ==========================================
  // FORMATEAR FECHA
  // ==========================================
  const formatearFecha = (timestamp: any) => {
    if (!timestamp?.toDate) {
      return "Fecha no disponible";
    }

    return timestamp.toDate().toLocaleString("es-PE");
  };

  // ==========================================
  // INTERFAZ DEL MÓDULO
  // ==========================================
  return (
    <div className="ventas-container">

      {/* ENCABEZADO */}
      <div className="ventas-encabezado">
        <div>
          <h1>Gestión de Ventas</h1>
          <p>Registro de cobros e historial de ventas.</p>
        </div>
      </div>

      {mensaje && (
        <div className="mensaje-ventas">
          {mensaje}
        </div>
      )}

      {/* RESUMEN */}
      <div className="resumen-ventas">

        <div className="resumen-venta-card">
          <span>Ventas del día</span>
          <strong>{ventasDelDia.length}</strong>
        </div>

        <div className="resumen-venta-card">
          <span>Recaudación del día</span>
          <strong>S/ {totalDelDia.toFixed(2)}</strong>
        </div>

        <div className="resumen-venta-card">
          <span>Pedidos por cobrar</span>
          <strong>{pedidosPorCobrar.length}</strong>
        </div>

      </div>

      {/* PEDIDOS PENDIENTES DE COBRO */}
      <section className="ventas-panel">

        <h2>Pedidos pendientes de cobro</h2>

        {cargando ? (
          <p>Cargando pedidos...</p>
        ) : pedidosPorCobrar.length === 0 ? (
          <p className="ventas-vacio">
            No hay pedidos entregados pendientes de cobro.
          </p>
        ) : (
          <div className="pedidos-cobro-grid">

            {pedidosPorCobrar.map((pedido) => (
              <article
                className="pedido-cobro-card"
                key={pedido.id}
              >

                <h3>Mesa {pedido.numeroMesa}</h3>

                <ul>
                  {pedido.items?.map((item, index) => (
                    <li key={index}>
                      {item.cantidad}x {item.nombre}

                      <span>
                        S/ {Number(item.subtotal).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="pedido-cobro-total">
                  <span>Total a cobrar</span>

                  <strong>
                    S/ {Number(pedido.total).toFixed(2)}
                  </strong>
                </div>

                <label>Método de pago</label>

                <select
                  value={metodosPago[pedido.id] || "Efectivo"}
                  onChange={(e) =>
                    cambiarMetodoPago(
                      pedido.id,
                      e.target.value
                    )
                  }
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Yape">Yape</option>
                  <option value="Plin">Plin</option>
                  <option value="Tarjeta">Tarjeta</option>
                </select>

                <button
                  type="button"
                  className="btn-registrar-venta"
                  disabled={procesando === pedido.id}
                  onClick={() => registrarVenta(pedido)}
                >
                  {procesando === pedido.id
                    ? "Registrando..."
                    : "Registrar cobro"}
                </button>

              </article>
            ))}

          </div>
        )}

      </section>

      {/* HISTORIAL DE VENTAS */}
      <section className="ventas-panel">

        <h2>Historial de ventas</h2>

        {ventas.length === 0 ? (
          <p className="ventas-vacio">
            Todavía no hay ventas registradas.
          </p>
        ) : (
          <div className="tabla-ventas-contenedor">

            <table className="tabla-ventas">

              <thead>
                <tr>
                  <th>Mesa</th>
                  <th>Productos</th>
                  <th>Total</th>
                  <th>Pago</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                </tr>
              </thead>

              <tbody>
                {ventas.map((venta) => (
                  <tr key={venta.id}>

                    <td>Mesa {venta.numeroMesa}</td>

                    <td>
                      {venta.items?.map((item) => (
                        <div
                          key={
                            item.productoId || item.nombre
                          }
                        >
                          {item.cantidad}x {item.nombre}
                        </div>
                      ))}
                    </td>

                    <td>
                      S/ {Number(venta.total).toFixed(2)}
                    </td>

                    <td>{venta.metodoPago}</td>

                    <td>
                      {formatearFecha(venta.creadoEn)}
                    </td>

                    <td>
                      <span className="venta-pagada">
                        Pagada
                      </span>
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>

          </div>
        )}

      </section>

    </div>
  );
}

export default Ventas;
