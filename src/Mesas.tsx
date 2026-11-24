
import { useEffect, useState } from "react";

import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  runTransaction,
} from "firebase/firestore";

import { db, auth } from "./firebase";
import "./Mesas.css";

interface Mesa {
  id: string;
  numero: number;
  capacidad: number;
  estado: "libre" | "ocupada" | "pendiente_pago";
  atencionActivaId: string | null;
}

function Mesas() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [mesaSeleccionada, setMesaSeleccionada] =
    useState<Mesa | null>(null);
  const [comensales, setComensales] = useState(2);
  const [procesando, setProcesando] = useState(false);

  // ESCUCHAR MESAS EN TIEMPO REAL
  useEffect(() => {
    const referencia = collection(db, "mesas");

    const cancelar = onSnapshot(
      referencia,
      (snapshot) => {
        const lista: Mesa[] = snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        } as Mesa));

        lista.sort((a, b) => a.numero - b.numero);

        setMesas(lista);
        setCargando(false);
      },
      (error) => {
        console.error("Error al consultar mesas:", error);
        setMensaje("No se pudieron cargar las mesas. Revisa Firebase.");
        setCargando(false);
      }
    );

    return () => cancelar();
  }, []);

  // REGISTRAR LAS 10 MESAS SIN SOBRESCRIBIR LAS EXISTENTES
  const registrarMesas = async () => {
    try {
      setProcesando(true);
      setMensaje("");

      const batch = writeBatch(db);

      for (let numero = 1; numero <= 10; numero++) {
        const referencia = doc(
          db,
          "mesas",
          `mesa-${String(numero).padStart(2, "0")}`
        );

        // merge conserva los campos de documentos existentes
        batch.set(
          referencia,
          {
            numero,
            capacidad: 4,
          },
          { merge: true }
        );
      }

      await batch.commit();

      setMensaje(
        "Las 10 mesas están registradas. Se conservaron sus estados actuales."
      );
    } catch (error) {
      console.error("Error al registrar mesas:", error);
      setMensaje(
        "Error al registrar las mesas. Revisa las reglas de Firestore."
      );
    } finally {
      setProcesando(false);
    }
  };

  // INICIAR ATENCIÓN
  const iniciarAtencion = async () => {
    if (!mesaSeleccionada) return;

    if (
      comensales < 1 ||
      comensales > mesaSeleccionada.capacidad
    ) {
      setMensaje(
        `La mesa admite de 1 a ${mesaSeleccionada.capacidad} comensales.`
      );
      return;
    }

    try {
      setProcesando(true);
      setMensaje("");

      const mesaRef = doc(db, "mesas", mesaSeleccionada.id);
      const atencionRef = doc(collection(db, "atenciones"));

      await runTransaction(db, async (transaction) => {
        const mesaDoc = await transaction.get(mesaRef);

        if (!mesaDoc.exists()) {
          throw new Error("La mesa no existe.");
        }

        const datosMesa = mesaDoc.data();

        if (datosMesa.estado !== "libre") {
          throw new Error("Esta mesa ya está ocupada.");
        }

        // CREAR ATENCIÓN
        transaction.set(atencionRef, {
          mesaId: mesaSeleccionada.id,
          numeroMesa: mesaSeleccionada.numero,
          mozoId: auth.currentUser?.uid ?? "usuario-demo",
          mozoNombre:
            auth.currentUser?.displayName ?? "Administrador (demo)",
          comensales,
          estado: "abierta",
          inicioEn: serverTimestamp(),
          cierreEn: null,
          total: 0,
        });

        // ACTUALIZAR MESA
        transaction.update(mesaRef, {
          estado: "ocupada",
          atencionActivaId: atencionRef.id,
        });
      });

      setMensaje(
        `¡Atención iniciada correctamente en la mesa ${mesaSeleccionada.numero}!`
      );

      setMesaSeleccionada(null);
    } catch (error) {
      console.error("Error al iniciar atención:", error);

      setMensaje(
        error instanceof Error
          ? error.message
          : "No se pudo iniciar la atención."
      );
    } finally {
      setProcesando(false);
    }
  };

  // CONTADORES
  const libres = mesas.filter(
    (mesa) => mesa.estado === "libre"
  ).length;

  const ocupadas = mesas.filter(
    (mesa) => mesa.estado === "ocupada"
  ).length;

  const pendientes = mesas.filter(
    (mesa) => mesa.estado === "pendiente_pago"
  ).length;

  return (
    <div className="mesas-container">

      <div className="mesas-encabezado">
        <div>
          <h1>Gestión de mesas</h1>
          <p>Administra las mesas de Pollería El Buen Sabor.</p>
        </div>

        <button
          className="btn-registrar"
          onClick={registrarMesas}
          disabled={procesando}
        >
          {procesando ? "Procesando..." : "Registrar 10 mesas"}
        </button>
      </div>

      <div className="resumen-mesas">

        <div className="resumen-card">
          <span>Mesas totales</span>
          <strong>{mesas.length}</strong>
        </div>

        <div className="resumen-card libre">
          <span>Mesas libres</span>
          <strong>{libres}</strong>
        </div>

        <div className="resumen-card ocupada">
          <span>Mesas ocupadas</span>
          <strong>{ocupadas}</strong>
        </div>

        <div className="resumen-card pendiente">
          <span>Pendientes de pago</span>
          <strong>{pendientes}</strong>
        </div>

      </div>

      {mensaje && (
        <div className="mensaje-mesas">
          {mensaje}
        </div>
      )}

      {cargando ? (
        <p>Cargando mesas desde Firebase...</p>
      ) : mesas.length === 0 ? (
        <div className="sin-mesas">
          <h2>No hay mesas registradas</h2>
          <p>Presiona el botón para registrar las 10 mesas iniciales.</p>
        </div>
      ) : (
        <div className="rejilla-mesas">

          {mesas.map((mesa) => (
            <div
              key={mesa.id}
              className={`mesa-card ${mesa.estado}`}
            >
              <div className="mesa-icono">🪑</div>

              <h2>
                Mesa {String(mesa.numero).padStart(2, "0")}
              </h2>

              <span className="estado-mesa">
                {mesa.estado === "libre"
                  ? "Libre"
                  : mesa.estado === "ocupada"
                  ? "Ocupada"
                  : "Pendiente de pago"}
              </span>

              <p>Capacidad: {mesa.capacidad} personas</p>

              {mesa.estado === "libre" ? (
                <button
                  className="btn-ocupar"
                  onClick={() => {
                    setMesaSeleccionada(mesa);
                    setComensales(2);
                    setMensaje("");
                  }}
                >
                  Iniciar atención
                </button>
              ) : (
                <button
                  className="btn-deshabilitado"
                  disabled
                >
                  Mesa ocupada
                </button>
              )}

            </div>
          ))}

        </div>
      )}

      {mesaSeleccionada && (
        <div className="modal-fondo">

          <div className="modal-mesa">

            <h2>Iniciar atención</h2>

            <p>
              Mesa {String(mesaSeleccionada.numero).padStart(2, "0")}
            </p>

            <label htmlFor="comensales">
              Número de comensales:
            </label>

            <input
              id="comensales"
              type="number"
              min="1"
              max={mesaSeleccionada.capacidad}
              value={comensales}
              onChange={(e) =>
                setComensales(Number(e.target.value))
              }
            />

            <div className="modal-botones">

              <button
                className="btn-cancelar"
                onClick={() => setMesaSeleccionada(null)}
                disabled={procesando}
              >
                Cancelar
              </button>

              <button
                className="btn-confirmar"
                onClick={iniciarAtencion}
                disabled={procesando}
              >
                {procesando
                  ? "Guardando..."
                  : "Confirmar atención"}
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

export default Mesas;
