import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { supabase } from "../services/supabase";
import { CheckCircle, XCircle } from "lucide-react";

export default function Scan() {
  const scannerRef = useRef(null);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (scannerRef.current) return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      false
    );

    scanner.render(onScanSuccess, onScanError);
    scannerRef.current = scanner;

    return () => {
      scanner.clear().catch(() => {});
    };
  }, []);

  const onScanSuccess = async (code) => {
    try {
      setError(null);

      const today = new Date().toISOString().slice(0, 10);
      const now = new Date();
      const time = now.toTimeString().slice(0, 8);

      const { data: emp } = await supabase
        .from("employees")
        .select("*")
        .eq("qr_code", code)
        .single();

      if (!emp) {
        setError("Employé introuvable");
        return;
      }

      const { data: attendance } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", emp.id)
        .eq("date", today)
        .single();

      // CHECK-IN
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

        setSuccess({ emp, message: "Entrée enregistrée" });
      }

      // CHECK-OUT
      else if (!attendance.check_out) {
        const hIn =
          parseInt(attendance.check_in.split(":")[0]) +
          parseInt(attendance.check_in.split(":")[1]) / 60;

        const hOut =
          now.getHours() + now.getMinutes() / 60;

        const hoursWorked = Math.max(0, hOut - hIn);
        const overtime = hOut > 18 ? hOut - 18 : 0;

        await supabase
          .from("attendance")
          .update({
            check_out: time,
            hours_worked: hoursWorked.toFixed(2),
            overtime_hours: overtime.toFixed(2)
          })
          .eq("id", attendance.id);

        setSuccess({ emp, message: "Sortie enregistrée" });
      } else {
        setError("Pointage déjà complété aujourd'hui");
      }

      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      console.error(e);
      setError("Erreur système");
    }
  };

  const onScanError = () => {};

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Scanner QR</h1>

      <div id="qr-reader" className="max-w-md mx-auto" />

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
