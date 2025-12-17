import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { QRCodeCanvas } from "qrcode.react";

export default function Employees() {
  const [list, setList] = useState([]);

  useEffect(() => {
    supabase.from("employees").select("*").then(({ data }) => {
      setList(data);
    });
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Employés</h1>

      <div className="grid md:grid-cols-3 gap-4">
        {list.map(e => (
          <div key={e.id} className="bg-white p-4 rounded-xl shadow">
            <p className="font-bold">{e.first_name} {e.last_name}</p>
            <p className="text-sm">{e.department}</p>
            <QRCodeCanvas value={e.qr_code} size={100} />
          </div>
        ))}
      </div>
    </div>
  );
}
