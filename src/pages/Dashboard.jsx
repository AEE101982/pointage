import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function Dashboard() {
  const [stats, setStats] = useState({});

  useEffect(() => {
    const loadStats = async () => {
      const today = new Date().toISOString().slice(0, 10);

      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("date", today);

      setStats({
        present: data.filter(d => d.status === "present").length,
        late: data.filter(d => d.status === "late").length,
        absent: data.filter(d => d.status === "absent").length
      });
    };
    loadStats();
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Tableau de bord</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Présents" value={stats.present} color="green" />
        <Card label="Retards" value={stats.late} color="orange" />
        <Card label="Absents" value={stats.absent} color="red" />
      </div>
    </div>
  );
}

function Card({ label, value, color }) {
  return (
    <div className={`bg-${color}-100 p-4 rounded-xl`}>
      <p className="text-sm">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
