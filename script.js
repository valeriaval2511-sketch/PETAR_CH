/* ===============================
   CONTROL PERMISOS - SCRIPT FULL
   Versión con carpeta local TRABAJADORES
================================= */

/* CONFIGURA SI QUIERES APPS SCRIPT */
const API_URL = "https://script.google.com/macros/s/AKfycbx8H8qyY1mP5I32hnlHd06dyTS6rZCjQPwTRHrQmM7FP_jJLKJ3XhMndOuPNpLSZZrE/exec"
const ALERTA_DIAS = 15;

/* ===== NUEVO: CARPETA LOCAL ===== */
let archivosLocal = [];

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

function loadData(){

  const status = document.getElementById("connectionStatus");

  fetch(API_URL + "?action=list")
  .then(res => {

    if(!res.ok){
      throw new Error("Respuesta no OK");
    }

    return res.json();
  })
  .then(json => {

    console.log("API OK:", json);

    if(json && json.ok){

      trabajadores = json.data;

      status.textContent = "Conectado a Google Sheets";
      status.style.background = "#1f7a4c"; // opcional verde

      // IMPORTANTE: refrescar UI
      renderControl();
      renderBulkList();
      renderChart();

    } else {

      throw new Error("JSON inválido");

    }

  })
  .catch(err => {

    console.error("ERROR FETCH:", err);

    trabajadores = DEMO_DATA;
    status.textContent = "Modo local";
    status.style.background = "#a94442"; // opcional rojo

    renderControl();
    renderBulkList();
    renderChart();

  });
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

    // AQUÍ VA JS (fuera del HTML)
    const existe = existeDocumento(dni, p.key);

    // AQUÍ VA SOLO HTML
    html += `
    <tr>
      <td>${p.label}</td>
      <td>${fmtDate(vig)}</td>
      <td><span class="badge ${st.clase}">${st.estado}</span></td>
      <td>${st.diasTexto}</td>
      <td>
        <button onclick="abrirDocumento('${dni}','${p.key}')">
          Abrir PDF
        </button>
        <span style="margin-left:8px; font-weight:bold; color:${existe ? 'green' : 'red'}">
          ${existe ? '✔' : '✖'}
        </span>
      </td>
    </tr>
    `;
  }

  tbody.innerHTML = html;
}

/* =========================
   NUEVO: CARPETA LOCAL
========================= */

function buscarArchivo(dni, tipo){

  return archivosLocal.find(file => {

    const path = file.webkitRelativePath.toUpperCase();

    return (
      path.includes(tipo.toUpperCase()) &&
      file.name.toUpperCase() === dni + ".PDF"
    );

  });

}

function existeDocumento(dni, tipo){

  const nombre = dni + ".pdf";

  return archivosLocal.some(f =>
    f.name === nombre &&
    f.webkitRelativePath.toUpperCase().includes(tipo.toUpperCase())
  );
}

function abrirDocumento(dni, tipo){

  const file = buscarArchivo(dni, tipo);

  if(!file){
    alert("No existe documento");
    return;
  }

  const url = URL.createObjectURL(file);

  window.open(url, "_blank");
}

/* =========================
   CONTROL
========================= */

function initFilters(){

  const guardias = [...new Set(permisosLong.map(x => x.guardia))];
  const areas = [...new Set(permisosLong.map(x => x.area))];
  const permisos = [...new Set(permisosLong.map(x => x.permiso))];

  const fG = document.getElementById("filterGuardia");
  const fA = document.getElementById("filterArea");
  const fP = document.getElementById("filterPermiso");

  if(fG){
    fG.innerHTML = '<option value="">Todas</option>' +
      guardias.map(g => `<option>${g}</option>`).join("");
  }

  if(fA){
    fA.innerHTML = '<option value="">Todas</option>' +
      areas.map(a => `<option>${a}</option>`).join("");
  }

  if(fP){
    fP.innerHTML = '<option value="">Todos</option>' +
      permisos.map(p => `<option>${p}</option>`).join("");
  }
const fE = document.getElementById("filterEstado");

if(fE){
  fE.innerHTML = `
    <option value="">Todos</option>
    <option value="VIGENTE">VIGENTE</option>
    <option value="POR VENCER">POR VENCER</option>
    <option value="NO VIGENTE">NO VIGENTE</option>
  `;
}
}
   
function renderControl(){

  const tbody = document.getElementById("controlTable");
  if(!tbody) return;

  const data = getDataFiltrada();

  let html = "";

  data.forEach(p => {

    html += `
    <tr>
      <td>${p.dni}</td>
      <td>${p.nombre}</td>
      <td>${p.guardia}</td>
      <td>${p.area}</td>
      <td>${p.permiso}</td>
      <td><span class="badge ${p.clase}">${p.estado}</span></td>
      <td>${p.diasTexto}</td>
    </tr>
    `;
  });

  tbody.innerHTML = html;
}

function renderBulkList(){

  const cont = document.getElementById("bulkList");
  if(!cont) return;

  const tipo = document.getElementById("bulkDocType")?.value || "";

  let html = "";

  trabajadores.forEach(w => {

    const existe = tipo 
      ? existeDocumento(w.DNI, tipo)
      : false;

    html += `
    <div class="bulk-item">
      <input type="checkbox" value="${w.DNI}">
      <div>
        <b>${w.NOMBRES} ${w.APELLIDOS}</b><br>
        DNI: ${w.DNI}<br>
        ${w["ÁREA"]} - ${w.GUARDIA}<br>
        <span style="color:${existe ? 'green' : 'red'}; font-weight:bold;">
          ${tipo ? (existe ? '✔ Documento' : '✖ No existe') : ''}
        </span>
      </div>
    </div>
    `;
  });

  cont.innerHTML = html;
}

function renderBulkList(){

  const cont = document.getElementById("bulkList");
  if(!cont) return;

  const tipo = document.getElementById("bulkDocType")?.value || "";
  const txt = document.getElementById("bulkDniFilter")?.value.toLowerCase() || "";

  // FILTRO REAL
  let lista = trabajadores.filter(w => {

    const nombre = (w.NOMBRES + " " + w.APELLIDOS).toLowerCase();
    const dni = w.DNI.toLowerCase();

    if(txt && !nombre.includes(txt) && !dni.includes(txt)){
      return false;
    }

    return true;
  });

  let html = "";

  lista.forEach(w => {

    const existe = tipo ? existeDocumento(w.DNI, tipo) : false;

    html += `
    <div class="bulk-item">
      <input type="checkbox" value="${w.DNI}">
      <div>
        <b>${w.NOMBRES} ${w.APELLIDOS}</b><br>
        DNI: ${w.DNI}<br>
        ${w["ÁREA"]} - ${w.GUARDIA}<br>
        <span style="color:${existe ? 'green' : 'red'}; font-weight:bold;">
          ${tipo ? (existe ? '✔ Disponible' : '✖ No existe') : ''}
        </span>
      </div>
    </div>
    `;
  });

  cont.innerHTML = html;
}

function renderChart(){

  const cont = document.getElementById("barChart");
  if(!cont) return;

  // sin filtro de estado
  const fG = document.getElementById("filterGuardia").value;
  const fA = document.getElementById("filterArea").value;
  const fP = document.getElementById("filterPermiso").value;

  const data = permisosLong.filter(p => {

    if(fG && p.guardia !== fG) return false;
    if(fA && p.area !== fA) return false;
    if(fP && p.permiso !== fP) return false;

    return true;
  });

  const estados = ["VIGENTE","POR VENCER","NO VIGENTE"];

  const counts = estados.map(e =>
    data.filter(x => x.estado === e).length
  );

  const max = Math.max(...counts,1);

  let html = "";

  estados.forEach((e,i)=>{

    const val = counts[i];

    // mínimo visible
    const h = Math.max((val / max) * 150, 10);

    let color = "#6b7280";
    if(e==="VIGENTE") color="#137333";
    if(e==="POR VENCER") color="#b85c00";
    if(e==="NO VIGENTE") color="#b42318";

    html += `
      <div class="bar">
        <div class="bar-fill" style="height:${h}px; background:${color}">
          ${val}
        </div>
        <label>${e}</label>
      </div>
    `;
  });

  cont.innerHTML = html;
}

function updateAll(){
  renderControl();
  renderChart();
}

function getDataFiltrada(){

  const fG = document.getElementById("filterGuardia").value;
  const fA = document.getElementById("filterArea").value;
  const fP = document.getElementById("filterPermiso").value;
  const fE = document.getElementById("filterEstado").value;

  return permisosLong.filter(p => {

    if(fG && p.guardia !== fG) return false;
    if(fA && p.area !== fA) return false;
    if(fP && p.permiso !== fP) return false;
    if(fE && p.estado !== fE) return false;

    return true;
  });
}

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

function cargarTiposDocumento(){

  const select = document.getElementById("bulkDocType");

  if(!select || archivosLocal.length === 0) return;

  // obtener carpetas únicas
  const tipos = new Set();

  archivosLocal.forEach(file => {
    const partes = file.webkitRelativePath.split("/");

    if(partes.length > 1){
      tipos.add(partes[1].toUpperCase());
    }
  });

  // llenar select
  select.innerHTML = `<option value="">Seleccionar</option>` +
    [...tipos].map(t => `<option value="${t}">${t}</option>`).join("");

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

  // Filtros
  ["filterGuardia","filterArea","filterPermiso","filterEstado"]
  .forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener("change", updateAll);
  });

  // Actualizar data
  document.getElementById("btnActualizar")
  .addEventListener("click", loadData);

  // Filtro DNI en lista
  document.getElementById("bulkDniFilter")
  .addEventListener("input", renderBulkList);

   document.getElementById("bulkDocType")
   .addEventListener("change", renderBulkList);

  // BOTÓN ABRIR DOCUMENTOS (CORRECTO)
  document.getElementById("btnOpenSelected")
  .addEventListener("click", () => {

    const tipo = document.getElementById("bulkDocType").value;

    if(!tipo){
      alert("Selecciona tipo de documento");
      return;
    }

    const checks = document.querySelectorAll("#bulkList input:checked");

    if(checks.length === 0){
      alert("Selecciona al menos un trabajador");
      return;
    }

    checks.forEach(ch => {
      abrirDocumento(ch.value, tipo);
    });

  });

  // Botón seleccionar carpeta
  document.getElementById("btnCarpeta")
  .addEventListener("click", () => {
    document.getElementById("folderInput").click();
  });

  // Leer carpeta local
  document.getElementById("folderInput")
  .addEventListener("change", (e) => {

    archivosLocal = Array.from(e.target.files);
      
     cargarTiposDocumento();

    console.log("Archivos cargados:", archivosLocal);

    document.getElementById("connectionStatus").textContent = "Carpeta cargada";

  });
      // Seleccionar todo
   document.getElementById("btnSelectAll")
   .addEventListener("click", () => {
   
     const checks = document.querySelectorAll("#bulkList input[type='checkbox']");
     const allChecked = [...checks].every(c => c.checked);
   
     checks.forEach(c => c.checked = !allChecked);
   });

   // Imprimir seleccionados
   document.getElementById("btnPrintSelected")
   .addEventListener("click", () => {
   
     const tipo = document.getElementById("bulkDocType").value;
   
     if(!tipo){
       alert("Selecciona tipo de documento");
       return;
     }
   
     const seleccionados = document.querySelectorAll("#bulkList input:checked");
   
     if(seleccionados.length === 0){
       alert("Selecciona al menos un trabajador");
       return;
     }
   
     seleccionados.forEach((ch, i) => {
   
       setTimeout(() => {
         abrirDocumento(ch.value, tipo);
       }, i * 700);
   
     });
   
   });
}

/* =========================
   START
========================= */

setupEvents();
loadData();
