import { useState } from "react";
import { QrReader } from "react-qr-reader";
import { supabase } from "../services/supabase";
import { CheckCircle, XCircle } from "lucide-react";

export default function Scan() {
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const handleScan = async (code) => {
    try {
      setError(null);

      const today = new Date().toISOString().slice(0, 10);
      const now = new Date();
      const time = now.toTimeString().slice(0, 8); // HH:MM:SS

      // 1️⃣ Récupérer employé
      const { data: emp, error: empError } = await supabase
        .from("employees")
        .select("*")
        .eq("qr_code", code)
        .single();

      if (empError || !emp) {
        setError("Employé introuvable");
        return;
      }

      // 2️⃣ Vérifier pointage du jour
      const { data: attendance } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", emp.id)
        .eq("date", today)
        .single();

      // 🟢 CAS 1 — PREMIER SCAN → CHECK-IN
      if (!attendance) {
        const hour = now.getHours() + now.getMinutes() / 60;

        let status = "present";
        if (hour > 9) status = "absent";
        else if (hour > 8.5) status = "late";

        await supabase.from("attendance").insert({
          employee_id: emp.id,
          date: today,
          check_in: time,
          status,
          recorded_by: "RH"
        });

        setSuccess({
          emp,
          message: "Entrée enregistrée"
        });
      }

      // 🟡 CAS 2 — CHECK-IN EXISTE → CHECK-OUT
      else if (!attendance.check_out) {
        const checkInHour =
          parseInt(attendance.check_in.split(":")[0]) +
          parseInt(attendance.check_in.split(":")[1]) / 60;

        const checkOutHour =
          now.getHours() + now.getMinutes() / 60;

        const hoursWorked = Math.max(0, checkOutHour - checkInHour);
        const overtime = checkOutHour > 18 ? checkOutHour - 18 : 0;

        await supabase
          .from("attendance")
          .update({
            check_out: time,
            hours_worked: hoursWorked.toFixed(2),
            overtime_hours: overtime.toFixed(2)
          })
          .eq("id", attendance.id);

        setSuccess({
          emp,
          message: "Sortie enregistrée"
        });
      }

      // 🔴 CAS 3 — DÉJÀ COMPLET
      else {
        setError("Pointage déjà complété pour aujourd'hui");
        return;
      }

      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError("Erreur système");
      console.error(e);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Scanner QR</h1>

      {!success && (
        <QrReader
          onResult={(res) => res && handleScan(res.text)}
          constraints={{ facingMode: "environment" }}
        />
      )}

      {success && (
        <div className="text-center mt-6 animate-pulse">
          <CheckCircle className="mx-auto text-green-500" size={80} />
          <h2 className="text-2xl font-bold">
            Bonjour {success.emp.first_name}
          </h2>
          <p>{success.message}</p>
        </div>
      )}

      {error && (
        <div className="text-center mt-6 text-red-600">
          <XCircle className="mx-auto" size={60} />
          <p className="font-bold">{error}</p>
        </div>
      )}
    </div>
  );
}
