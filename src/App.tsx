
import { useEffect, useState } from "react";

import {
  LayoutDashboard,
  Utensils,
  ClipboardList,
  ChefHat,
  Users,
  LogOut,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  Flame,
} from "lucide-react";

import {
  collection,
  onSnapshot,
} from "firebase/firestore";

import { db } from "./firebase";

import "./App.css";
import Mesas from "./Mesas";
import Pedidos from "./Pedidos";
import Cocina from "./Cocina";
import Productos from "./Productos";
import Usuarios from "./Usuarios";
import Ventas from "./Ventas";

interface Mesa {
  id: string;
  numero: number;
  estado: string;
}

interface ItemProducto {
  nombre: string;
  cantidad: number;
}

interface Pedido {
  id: string;
  numeroMesa: number;
  estado: string;
  total: number;
  creadoEn?: any;
  items?: ItemProducto[];
}

interface Venta {
  id: string;
  numeroMesa: number;
  total: number;
  metodoPago: string;
  creadoEn?: any;
  items?: ItemProducto[];
}

function App() {
  const [seccion, setSeccion] = useState("Inicio");

  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);

  const [cargandoMesas, setCargandoMesas] = useState(true);
  const [cargandoPedidos, setCargandoPedidos] = useState(true);
  const [cargandoVentas, setCargandoVentas] = useState(true);

  const cargandoDashboard =
    cargandoMesas || cargandoPedidos || cargandoVentas;

  // OPCIONES DEL MENÚ
  const opciones = [
    { nombre: "Inicio", icono: LayoutDashboard },
    { nombre: "Mesas", icono: Utensils },
    { nombre: "Pedidos", icono: ClipboardList },
    { nombre: "Cocina", icono: ChefHat },
    { nombre: "Productos", icono: ShoppingBag },
    { nombre: "Usuarios", icono: Users },
    { nombre: "Ventas", icono: DollarSign },
  ];

  // ESCUCHAR MESAS
  useEffect(() => {
    const cancelar = onSnapshot(
      collection(db, "mesas"),
      (snapshot) => {
        const lista = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Mesa[];

        setMesas(lista);
        setCargandoMesas(false);
      },
      (error) => {
        console.error("Error al cargar mesas:", error);
        setCargandoMesas(false);
      }
    );

    return () => cancelar();
  }, []);

  // ESCUCHAR PEDIDOS
  useEffect(() => {
    const cancelar = onSnapshot(
      collection(db, "pedidos"),
      (snapshot) => {
        const lista = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Pedido[];

        setPedidos(lista);
        setCargandoPedidos(false);
      },
      (error) => {
        console.error("Error al cargar pedidos:", error);
        setCargandoPedidos(false);
      }
    );

    return () => cancelar();
  }, []);

  // ESCUCHAR VENTAS
  useEffect(() => {
    const cancelar = onSnapshot(
      collection(db, "ventas"),
      (snapshot) => {
        const lista = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Venta[];

        setVentas(lista);
        setCargandoVentas(false);
      },
      (error) => {
        console.error("Error al cargar ventas:", error);
        setCargandoVentas(false);
      }
    );

    return () => cancelar();
  }, []);

  // FECHA ACTUAL
  const hoy = new Date();

  // COMPROBAR SI UNA FECHA ES DE HOY
  const esDeHoy = (fecha: any) => {
    if (!fecha?.toDate) return false;

    return (
      fecha.toDate().toDateString() === hoy.toDateString()
    );
  };

  // VENTAS DEL DÍA
  const ventasDelDia = ventas.filter((venta) =>
    esDeHoy(venta.creadoEn)
  );

  // RECAUDACIÓN DEL DÍA
  const recaudacion = ventasDelDia.reduce(
    (total, venta) => total + Number(venta.total || 0),
    0
  );

  // MESAS
  const mesasOcupadas = mesas.filter(
    (mesa) => mesa.estado === "ocupada"
  ).length;

  const mesasLibres = mesas.filter(
    (mesa) => mesa.estado === "libre"
  ).length;

  const mesasPendientesPago = mesas.filter(
    (mesa) => mesa.estado === "pendiente_pago"
  ).length;

  // PEDIDOS DEL DÍA
  const pedidosDelDia = pedidos.filter((pedido) =>
    esDeHoy(pedido.creadoEn)
  );

  const pendientes = pedidosDelDia.filter(
    (pedido) => pedido.estado === "pendiente"
  ).length;

  const preparando = pedidosDelDia.filter(
    (pedido) => pedido.estado === "preparando"
  ).length;

  const pedidosListos = pedidosDelDia.filter(
    (pedido) => pedido.estado === "listo"
  ).length;

  // ENTREGADOS DE HOY
  const pedidosEntregados = pedidosDelDia.filter(
    (pedido) => pedido.estado === "entregado"
  ).length;

  // PRODUCTOS MÁS VENDIDOS
  const cantidadesProductos: Record<string, number> = {};

  ventas.forEach((venta) => {
    venta.items?.forEach((item) => {
      cantidadesProductos[item.nombre] =
        (cantidadesProductos[item.nombre] || 0) +
        Number(item.cantidad || 0);
    });
  });

  const productosMasVendidos = Object.entries(
    cantidadesProductos
  )
    .map(([nombre, cantidad]) => ({
      nombre,
      cantidad,
    }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5);

  // ÚLTIMAS VENTAS
  const ultimasVentas = [...ventas]
    .sort((a, b) => {
      const fechaA =
        a.creadoEn?.toDate?.()?.getTime() || 0;

      const fechaB =
        b.creadoEn?.toDate?.()?.getTime() || 0;

      return fechaB - fechaA;
    })
    .slice(0, 5);

  // FORMATEAR FECHA
  const formatearFecha = (fecha: any) => {
    if (!fecha?.toDate) return "Fecha no disponible";

    return fecha.toDate().toLocaleString("es-PE");
  };

  return (
    <div className="app-container">

      {/* MENÚ LATERAL */}
      <aside className="sidebar">

        <div className="logo">
          <span>🍗</span>

          <div>
            <h2>EL BUEN SABOR</h2>
            <small>Pollería</small>
          </div>
        </div>

        <p className="menu-title">MENÚ PRINCIPAL</p>

        <nav>
          {opciones.map((opcion) => {
            const Icono = opcion.icono;

            return (
              <button
                key={opcion.nombre}
                className={
                  seccion === opcion.nombre
                    ? "menu-item activo"
                    : "menu-item"
                }
                onClick={() => setSeccion(opcion.nombre)}
              >
                <Icono size={20} />
                {opcion.nombre}
              </button>
            );
          })}
        </nav>

        <button className="cerrar-sesion">
          <LogOut size={20} />
          Cerrar sesión
        </button>

      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="contenido">

        {/* ENCABEZADO */}
        <header className="topbar">

          <div>
            <h2>Pollería El Buen Sabor</h2>
            <p>Sistema de gestión de pedidos</p>
          </div>

          <div className="usuario">
            <span>Administrador</span>
            <div className="avatar">A</div>
          </div>

        </header>

        {/* MÓDULO INICIO */}
        {seccion === "Inicio" ? (

          <div className="dashboard">

            {/* BIENVENIDA */}
            <section className="bienvenida">

              <div>
                <h1>¡Bienvenido a El Buen Sabor! 🍗</h1>

                <p>
                  Resumen general de tu pollería.
                  Administra tu negocio desde un solo lugar.
                </p>
              </div>

              <div className="fecha-dashboard">
                {hoy.toLocaleDateString("es-PE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>

            </section>

            {cargandoDashboard ? (

              <p>Cargando información del negocio...</p>

            ) : (

              <>

                {/* TARJETAS PRINCIPALES */}
                <div className="estadisticas">

                  <div className="tarjeta dashboard-ventas">

                    <div className="tarjeta-icono">
                      <DollarSign />
                    </div>

                    <span>Ventas del día</span>

                    <h2>S/ {recaudacion.toFixed(2)}</h2>

                    <p>
                      {ventasDelDia.length} ventas registradas
                    </p>

                  </div>

                  <div className="tarjeta dashboard-pedidos">

                    <div className="tarjeta-icono">
                      <ClipboardList />
                    </div>

                    <span>Pedidos del día</span>

                    <h2>{pedidosDelDia.length}</h2>

                    <p>Pedidos registrados hoy</p>

                  </div>

                  <div className="tarjeta dashboard-ocupadas">

                    <div className="tarjeta-icono">
                      <Utensils />
                    </div>

                    <span>Mesas ocupadas</span>

                    <h2>{mesasOcupadas}</h2>

                    <p>Mesas en atención</p>

                  </div>

                  <div className="tarjeta dashboard-libres">

                    <div className="tarjeta-icono">
                      <CheckCircle />
                    </div>

                    <span>Mesas disponibles</span>

                    <h2>{mesasLibres}</h2>

                    <p>Mesas libres</p>

                  </div>

                </div>

                {/* MESAS PENDIENTES DE PAGO */}
                {mesasPendientesPago > 0 && (
                  <section className="panel-dashboard">
                    <h2>
                      <Clock size={20} />
                      Mesas pendientes de pago: {mesasPendientesPago}
                    </h2>
                  </section>
                )}

                {/* ESTADOS DE PEDIDOS */}
                <section className="panel-dashboard">

                  <div className="titulo-panel">
                    <h2>
                      <Clock size={20} />
                      Estado de pedidos de hoy
                    </h2>
                  </div>

                  <div className="estados-dashboard">

                    <div className="estado-dashboard pendiente">
                      <span>Pendientes</span>
                      <strong>{pendientes}</strong>
                    </div>

                    <div className="estado-dashboard preparando">
                      <span>En preparación</span>
                      <strong>{preparando}</strong>
                    </div>

                    <div className="estado-dashboard listo">
                      <span>Listos</span>
                      <strong>{pedidosListos}</strong>
                    </div>

                    <div className="estado-dashboard entregado">
                      <span>Entregados</span>
                      <strong>{pedidosEntregados}</strong>
                    </div>

                  </div>

                </section>

                {/* PRODUCTOS MÁS VENDIDOS */}
                <section className="panel-dashboard">

                  <div className="titulo-panel">
                    <h2>
                      <Flame size={20} />
                      Productos más vendidos
                    </h2>
                  </div>

                  {productosMasVendidos.length === 0 ? (

                    <p className="dashboard-vacio">
                      Todavía no hay productos vendidos.
                    </p>

                  ) : (

                    <div className="lista-productos-dashboard">

                      {productosMasVendidos.map((producto, index) => (

                        <div
                          className="producto-dashboard"
                          key={producto.nombre}
                        >

                          <div className="producto-ranking">
                            {index + 1}
                          </div>

                          <div className="producto-ranking-info">

                            <strong>{producto.nombre}</strong>

                            <span>
                              {producto.cantidad} unidades vendidas
                            </span>

                          </div>

                        </div>

                      ))}

                    </div>

                  )}

                </section>

                {/* ÚLTIMAS VENTAS */}
                <section className="panel-dashboard">

                  <div className="titulo-panel">
                    <h2>
                      <TrendingUp size={20} />
                      Últimas ventas
                    </h2>
                  </div>

                  {ultimasVentas.length === 0 ? (

                    <p className="dashboard-vacio">
                      Todavía no hay ventas registradas.
                    </p>

                  ) : (

                    <div className="tabla-dashboard-contenedor">

                      <table className="tabla-dashboard">

                        <thead>
                          <tr>
                            <th>Mesa</th>
                            <th>Total</th>
                            <th>Pago</th>
                            <th>Fecha</th>
                          </tr>
                        </thead>

                        <tbody>

                          {ultimasVentas.map((venta) => (

                            <tr key={venta.id}>

                              <td>Mesa {venta.numeroMesa}</td>

                              <td>
                                S/ {Number(venta.total).toFixed(2)}
                              </td>

                              <td>{venta.metodoPago}</td>

                              <td>
                                {formatearFecha(venta.creadoEn)}
                              </td>

                            </tr>

                          ))}

                        </tbody>

                      </table>

                    </div>

                  )}

                </section>

              </>

            )}

          </div>

        ) : seccion === "Mesas" ? (

          <Mesas />

        ) : seccion === "Pedidos" ? (

          <Pedidos />

        ) : seccion === "Cocina" ? (

          <Cocina />

        ) : seccion === "Productos" ? (

          <Productos />

        ) : seccion === "Usuarios" ? (

          <Usuarios />

        ) : seccion === "Ventas" ? (

          <Ventas />

        ) : (

          <div className="panel">
            <h2>{seccion}</h2>

            <p>
              El módulo de {seccion.toLowerCase()}
              se desarrollará en los siguientes pasos.
            </p>
          </div>

        )}

      </main>

    </div>
  );
}

export default App;
