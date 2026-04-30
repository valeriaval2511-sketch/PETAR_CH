/* ===============================
   CONTROL PERMISOS - SCRIPT FULL
   Versión con carpeta local TRABAJADORES
================================= */

/* CONFIGURA SI QUIERES APPS SCRIPT */
const API_URL = "https://script.google.com/macros/s/AKfycbzRB4G4Or7u48A6dFs3MIWl9pMGv6LunDtP2Xhr-vDew0qM3_rkOt1bcErNRZf1jMAO/exec"
const ALERTA_DIAS = 15;

/* ===== NUEVO: CARPETA LOCAL ===== */
let carpetaTrabajadores = null;
let archivosLocales = {};

/* ===== PERMISOS ===== */
const PERMISOS = [
  { key:"DNI", label:"Documento DNI", vigenciaCol:null, emoCol:null },
  { key:"LICENCIA", label:"Licencia de Conducir", vigenciaCol:"VIGENCIA LICENCIA", emoCol:null },
  { key:"ALTURA", label:"Trabajo en Altura", vigenciaCol:"VIGENCIA AUTORIZACION T. ALTURA", emoCol:"FECHA EMO - ALTURA" },
  { key:"CALIENTE", label:"Trabajo en Caliente", vigenciaCol:"VIGENCIA AUTORIZACION T. CALIENTE", emoCol:"FECHA EMO - CALIENTE" },
  { key:"CONFINADO", label:"Espacios Confinados", vigenciaCol:"VIGENCIA AUTORIZACION T. E. CONFINADO", emoCol:"FECHA EMO - CONFINADOS" },
  { key:"IZAJE", label:"Trabajo de Izaje", vigenciaCol:"VIGENCIA AUTORIZACION T. DE IZAJE", emoCol:null }
];

const COLS = {
  dni:"DNI",
  apellidos:"APELLIDOS",
  nombres:"NOMBRES",
  cargo:"CARGO",
  area:"ÁREA",
  guardia:"GUARDIA",
  licencia:"NRO LICENCIA",
  categoria:"CATEGORIA",
  equipo:"EQUIPO",
  restriccion:"RESTRICCION"
};

let trabajadores = [];
let permisosLong = [];
let currentWorker = null;

/* ===== DEMO ===== */
const DEMO_DATA = [
{
"DNI":"12345678",
"APELLIDOS":"PÉREZ ROJAS",
"NOMBRES":"JUAN",
"CARGO":"OPERADOR",
"ÁREA":"MINA",
"GUARDIA":"A",
"NRO LICENCIA":"Q12345678",
"CATEGORIA":"AIIIC",
"EQUIPO":"JUMBO",
"RESTRICCION":"Sin restricción",
"VIGENCIA LICENCIA":"2026-12-30",
"VIGENCIA AUTORIZACION T. ALTURA":"2026-05-10",
"FECHA EMO - ALTURA":"2026-01-10",
"VIGENCIA AUTORIZACION T. CALIENTE":"2026-04-20",
"FECHA EMO - CALIENTE":"2026-01-10",
"VIGENCIA AUTORIZACION T. E. CONFINADO":"2026-07-15",
"FECHA EMO - CONFINADOS":"2026-01-10",
"VIGENCIA AUTORIZACION T. DE IZAJE":"2026-08-20"
}
];

/* =========================
   FUNCIONES BASE
========================= */

function normalizeDni(x){
  let s = String(x ?? "").trim().replace(/\s/g,"");
  if(s.endsWith(".0")) s = s.slice(0,-2);
  if(/^\d+$/.test(s) && s.length < 8) s = s.padStart(8,"0");
  return s;
}

function parseDate(value){
  if(!value) return null;

  const s = String(value).trim();

  if(/^\d{4}-\d{2}-\d{2}/.test(s)){
    const [y,m,d] = s.split("-").map(Number);
    return new Date(y,m-1,d);
  }

  if(/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)){
    const [d,m,y] = s.split("/").map(Number);
    return new Date(y,m-1,d);
  }

  return null;
}

function fmtDate(d){
  return d ? d.toLocaleDateString("es-PE") : "Sin información";
}

function get(row,col){
  return row?.[col] ?? "";
}

function fullName(row){
  return `${get(row,COLS.apellidos)} ${get(row,COLS.nombres)}`.trim();
}

function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),3000);
}

function daysBetween(a,b){
  return Math.round((a-b)/(1000*60*60*24));
}

function statusFromVigencia(vig){
  if(!vig) return {
    estado:"Sin información",
    diasTexto:"—",
    clase:"unknown"
  };

  const hoy = new Date();
  const h = new Date(hoy.getFullYear(),hoy.getMonth(),hoy.getDate());

  const delta = daysBetween(vig,h);

  if(delta < 0){
    return {
      estado:"NO VIGENTE",
      diasTexto:`Venció hace ${Math.abs(delta)} día(s)`,
      clase:"bad"
    };
  }

  if(delta === 0){
    return {
      estado:"POR VENCER",
      diasTexto:"VENCE HOY",
      clase:"warn"
    };
  }

  if(delta <= ALERTA_DIAS){
    return {
      estado:"POR VENCER",
      diasTexto:`Faltan ${delta} día(s)`,
      clase:"warn"
    };
  }

  return {
    estado:"VIGENTE",
    diasTexto:`Faltan ${delta} día(s)`,
    clase:"ok"
  };
}

/* =========================
   CARGA DATA
========================= */

async function loadData(){

  const status =
    document.getElementById("connectionStatus");

  try{

    status.textContent = "Conectando...";

    const res = await fetch(
      API_URL + "?action=list",
      {
        method:"GET",
        mode:"cors"
      }
    );

    const json = await res.json();

    if(!json.ok){
      throw new Error("Sin data");
    }

    trabajadores = json.data.map(x => ({
      ...x,
      DNI: normalizeDni(x.DNI)
    }));

    status.textContent =
      "Conectado a Google Sheets";

  }catch(error){

    console.log(error);

    trabajadores = DEMO_DATA.map(x => ({
      ...x,
      DNI: normalizeDni(x.DNI)
    }));

    status.textContent =
      "Modo local";

  }

  permisosLong = buildPermisosLong();

  initFilters();
  renderControl();
  renderBulkList();
}

/* =========================
   PERMISOS LONG
========================= */

function buildPermisosLong(){
  const rows = [];

  for(const w of trabajadores){

    for(const p of PERMISOS){

      if(!p.vigenciaCol) continue;

      const vig = parseDate(get(w,p.vigenciaCol));
      const st = statusFromVigencia(vig);

      rows.push({
        dni: normalizeDni(get(w,COLS.dni)),
        nombre: fullName(w),
        guardia: get(w,COLS.guardia),
        area: get(w,COLS.area),
        permiso: p.label,
        key: p.key,
        estado: st.estado,
        clase: st.clase,
        diasTexto: st.diasTexto
      });
    }
  }

  return rows;
}

/* =========================
   BUSCAR TRABAJADOR
========================= */

function searchWorker(){

  const dni = normalizeDni(
    document.getElementById("dniInput").value
  );

  const worker = trabajadores.find(
    x => normalizeDni(x.DNI) === dni
  );

  if(!worker){
    toast("No encontrado.");
    return;
  }

  currentWorker = worker;

  renderWorkerInfo(worker);
  renderWorkerPerms(worker);
}

function renderWorkerInfo(w){

  document.getElementById("workerInfo").innerHTML = `
  <div class="info-item"><small>Nombre</small><strong>${fullName(w)}</strong></div>
  <div class="info-item"><small>DNI</small><strong>${w.DNI}</strong></div>
  <div class="info-item"><small>Cargo</small><strong>${get(w,COLS.cargo)}</strong></div>
  <div class="info-item"><small>Área</small><strong>${get(w,COLS.area)}</strong></div>
  `;
}

function renderWorkerPerms(worker){

  const dni = worker.DNI;
  const tbody = document.getElementById("permTable");

  let html = "";

  for(const p of PERMISOS){

    const vig = parseDate(get(worker,p.vigenciaCol));
    const st = p.vigenciaCol
      ? statusFromVigencia(vig)
      : {estado:"—",clase:"unknown",diasTexto:"—"};

    html += `
    <tr>
      <td>${p.label}</td>
      <td>${fmtDate(vig)}</td>
      <td><span class="badge ${st.clase}">${st.estado}</span></td>
      <td>${st.diasTexto}</td>
      <td>
        <button onclick="openDocument('${dni}','${p.key}')">
        Abrir PDF
        </button>
      </td>
    </tr>
    `;
  }

  tbody.innerHTML = html;
}

/* =========================
   NUEVO: CARPETA LOCAL
========================= */

async function seleccionarCarpetaTrabajadores(){

  try{

    carpetaTrabajadores =
      await window.showDirectoryPicker();

    archivosLocales = {};

    for await (const [nombre, handle] of carpetaTrabajadores.entries()){

      if(handle.kind === "directory"){
        archivosLocales[nombre.toUpperCase()] = handle;
      }
    }

    toast("Carpeta cargada correctamente.");

  }catch(e){

    toast("No se seleccionó carpeta.");

  }
}

async function openDocument(dni,key){

  try{

    if(!carpetaTrabajadores){
      toast("Primero selecciona carpeta.");
      return;
    }

    const sub = archivosLocales[key.toUpperCase()];

    if(!sub){
      toast("No existe carpeta " + key);
      return;
    }

    const fileHandle =
      await sub.getFileHandle(dni + ".pdf");

    const file = await fileHandle.getFile();

    const url = URL.createObjectURL(file);

    window.open(url,"_blank");

  }catch(e){

    toast("No existe PDF.");

  }
}

/* =========================
   CONTROL
========================= */

function initFilters(){}

function renderControl(){}

function renderBulkList(){}

/* =========================
   EVENTOS
========================= */
function openSelectedDocs(){

  const checks = document.querySelectorAll(".bulk-check:checked");

  if(checks.length === 0){
    toast("Selecciona al menos un trabajador.");
    return;
  }

  checks.forEach(c => {
    console.log("Seleccionado:", c.value);
  });

  toast("Función activa.");
}

function setupEvents(){

  // Buscar DNI
  document.getElementById("btnBuscar")
  .addEventListener("click", searchWorker);

  // Enter DNI
  document.getElementById("dniInput")
  .addEventListener("keydown", function(e){
    if(e.key === "Enter"){
      searchWorker();
    }
  });

  // Carpeta
  document.getElementById("btnCarpeta")
  .addEventListener("click", seleccionarCarpetaTrabajadores);

  // Tabs
  document.querySelectorAll(".tab").forEach(tab => {

    tab.addEventListener("click", function(){

      document.querySelectorAll(".tab")
      .forEach(x => x.classList.remove("active"));

      this.classList.add("active");

      const destino = this.dataset.tab;

      document.querySelectorAll(".panel")
      .forEach(p => p.classList.remove("active"));

      document.getElementById(destino)
      .classList.add("active");

    });

  });

  // filtros
  ["filterGuardia","filterArea","filterPermiso","filterEstado"]
  .forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener("change", renderControl);
  });

  // actualizar
  document.getElementById("btnActualizar")
  .addEventListener("click", loadData);

  // bulk
  document.getElementById("bulkDniFilter")
  .addEventListener("input", renderBulkList);

  document.getElementById("btnOpenSelected")
  .addEventListener("click", openSelectedDocs);

}

/* =========================
   START
========================= */

setupEvents();
loadData();
