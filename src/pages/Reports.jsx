import * as XLSX from "xlsx";
import { supabase } from "../services/supabase";

export default function Reports() {
  const exportExcel = async () => {
    const { data } = await supabase.from("attendance").select("*");
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rapport");
    XLSX.writeFile(wb, "rapport.xlsx");
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Rapports</h1>
      <button onClick={exportExcel} className="btn-primary">
        Télécharger Excel
      </button>
    </div>
  );
}
