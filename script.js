/* ===============================
   CONTROL PERMISOS - SCRIPT FULL
   Versión con carpeta local TRABAJADORES
================================= */

/* CONFIGURA SI QUIERES APPS SCRIPT */
const API_URL = "https://script.google.com/macros/s/AKfycbw7sEU7xXVfAZpKkXl0WxFi6njJH-I-1Onq_HlzsudrMoXeaRXLpC86WpxPzBmnU693/exec"
const ALERTA_DIAS = 15;

/* ===== NUEVO: CARPETA LOCAL ===== */
let archivosLocal = [];

/* ===== PERMISOS ===== */
const PERMISOS = [
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

let bulkCurrentPage = 1;
let bulkPerPage = 16;

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

  if(!vig){
    return {
      estado: "SIN INFORMACIÓN",
      dias: null,
      color: "gray"
    };
  }

  const hoy = new Date();
  hoy.setHours(0,0,0,0);

  const fecha = new Date(vig);
  fecha.setHours(0,0,0,0);

  const diff =
    Math.ceil(
      (fecha - hoy) / (1000 * 60 * 60 * 24)
    );

  // vencido
  if(diff < 0){
    return {
      estado: "NO VIGENTE",
      dias: diff,
      color: "red"
    };
  }

  // vence en 15 días
  if(diff <= 15){
    return {
      estado: "POR VENCER (15 DÍAS)",
      dias: diff,
      color: "orange"
    };
  }

  // vence en 30 días
  if(diff <= 30){
    return {
      estado: "POR VENCER (30 DÍAS)",
      dias: diff,
      color: "yellow"
    };
  }

  // vigente normal
  return {
    estado: "VIGENTE",
    dias: diff,
    color: "green"
  };
}

/* =========================
   CARGA DATA
========================= */

function loadData(){

  const status = document.getElementById("connectionStatus");
  const docHeader = document.getElementById("docHeader");

  fetch(API_URL + "?action=list")
  .then(res => {

    console.log("STATUS FETCH:", res.status);

    if(!res.ok){
      throw new Error("Respuesta no OK");
    }

    return res.json();
  })

  .then(json => {

    console.log("API OK:", json);

    if(!json || !json.ok){
      throw new Error("JSON inválido");
    }

    trabajadores = json.data;

    permisosLong = buildPermisosLong();
    initFilters();

    status.innerHTML = `
      <i class="fa-solid fa-database"></i>
      <div>
        <strong>Conectado</strong>
        <span>Base de datos</span>
      </div>
    `;

    status.classList.remove("off");

    renderControl();
    renderBulkList();
    renderChart();

    // ocultar columna documento al iniciar
    if(docHeader){
      docHeader.style.display = "none";
    }

  })

  .catch(err => {

    console.error("ERROR FETCH:", err);

    trabajadores = DEMO_DATA;

    permisosLong = buildPermisosLong();
    initFilters();

    status.innerHTML = `
      <i class="fa-solid fa-database"></i>
      <div>
        <strong>Sin conexión</strong>
        <span>Base de datos</span>
      </div>
    `;

    status.classList.add("off");

    renderControl();
    renderBulkList();
    renderChart();

    if(docHeader){
      docHeader.style.display = "none";
    }

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
   
   if(!dni){
     return;
   }
   
   const worker = trabajadores.find(
     x => normalizeDni(x.DNI) === dni
   );

   if(!worker){

     const valorInput = document
       .getElementById("dniInput")
       .value
       .trim();
   
     if(valorInput !== ""){
       toast("No encontrado.");
     }
   
     return;
   }

  currentWorker = worker;

   renderWorkerInfo(worker);
      
   const img = document.getElementById("fotoTrabajador");

   if(worker.FOTO_URL){
       img.src = worker.FOTO_URL;
   }else{
       img.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
   }

   /* =========================
         🔥 ESTADO GLOBAL (AQUÍ VA)
      ========================= */
      
      let tieneBad = false;
      let tieneWarn = false;
      
      PERMISOS.forEach(p => {
      
        if(!p.vigenciaCol) return;
      
        const vig = parseDate(worker[p.vigenciaCol]);
        const st = statusFromVigencia(vig);
      
        if(st.estado === "NO VIGENTE") tieneBad = true;
        else if(st.estado === "POR VENCER") tieneWarn = true;
      
      });
      
      /* limpiar clases */
      img.classList.remove("ok","warn","bad");
      
      /* aplicar prioridad */
      if(tieneBad){
        img.classList.add("bad");
      }else if(tieneWarn){
        img.classList.add("warn");
      }else{
        img.classList.add("ok");
      }
      
      /* =========================
         FIN BLOQUE
      ========================= */
   renderWorkerPerms(worker);
   renderWorkerSummary(worker);
}

function renderWorkerInfo(w){

  workerInfo.innerHTML = `
  
    <div class="info-item">
      <small>Nombre:</small>
      <strong>${fullName(w)}</strong>
    </div>

    <div class="info-item">
      <small>Guardia:</small>
      <strong>${get(w,COLS.guardia)}</strong>
    </div>

    <div class="info-item">
      <small>Nro Licencia:</small>
      <strong>${get(w,COLS.licencia)}</strong>
    </div>

    <div class="info-item">
      <small>Categoría:</small>
      <strong>${get(w,COLS.categoria)}</strong>
    </div>

    <div class="info-item">
      <small>Cargo:</small>
      <strong>${get(w,COLS.cargo)}</strong>
    </div>

    <div class="info-item">
      <small>Área:</small>
      <strong>${get(w,COLS.area)}</strong>
    </div>

    <div class="info-item">
      <small>Equipo:</small>
      <strong>${get(w,COLS.equipo) || "-"}</strong>
    </div>

    <div class="info-item">
      <small>Restricción:</small>
      <strong>${get(w,COLS.restriccion) || "-"}</strong>
    </div>
    
  `;
}

function renderWorkerPerms(worker){

  const dni = worker.DNI;
  const tbody = document.getElementById("permTable");
  const docHeader = document.getElementById("docHeader");

  let html = "";

  // Mostrar u ocultar columna documento
  if(docHeader){
    docHeader.style.display = archivosLocal.length ? "" : "none";
  }

  for(const p of PERMISOS){

    const emo = p.emoCol
      ? parseDate(get(worker,p.emoCol))
      : null;

    const vig = p.vigenciaCol
      ? parseDate(get(worker,p.vigenciaCol))
      : null;

    const st = p.vigenciaCol
      ? statusFromVigencia(vig)
      : {
          estado:"—",
          clase:"unknown",
          diasTexto:"—"
        };

    const existe = existeDocumento(dni,p.key);

    html += `
      <tr>
        <td>${p.label}</td>
        <td>${fmtDate(emo)}</td>
        <td>${fmtDate(vig)}</td>

        <td>
          <span class="badge ${st.clase}">
            ${st.estado}
          </span>
        </td>

        <td>${st.diasTexto}</td>

        ${
          archivosLocal.length
          ? `
            <td>
              <button onclick="abrirDocumento('${dni}','${p.key}')">
                Abrir PDF
              </button>

              <span style="
                margin-left:8px;
                font-weight:bold;
                color:${existe ? 'green' : 'red'};
              ">
                ${existe ? "✔" : "✖"}
              </span>
            </td>
          `
          : ""
        }

      </tr>
    `;
  }

  tbody.innerHTML = html;
}

function renderWorkerSummary(worker){

  const cont = document.getElementById("workerSummary");
  if(!cont) return;

  let vigentes = 0;
  let porVencer30 = 0;
  let porVencer15 = 0;
  let noVigentes = 0;

  PERMISOS.forEach(p => {

    if(!p.vigenciaCol) return;

    const vig = parseDate(get(worker,p.vigenciaCol));
    const st = statusFromVigencia(vig);

    if(st.estado === "VIGENTE"){
      vigentes++;
    }

    else if(st.estado === "POR VENCER (30 DÍAS)"){
      porVencer30++;
    }

    else if(st.estado === "POR VENCER (15 DÍAS)"){
      porVencer15++;
    }

    else if(st.estado === "NO VIGENTE"){
      noVigentes++;
    }

  });

  cont.innerHTML = `

    <div class="kpi ok">
      <div class="kpi-content">
        <span>Vigentes</span>

        <div class="kpi-number-row">
          <i class="fa-regular fa-circle-check"></i>
          <b>${vigentes}</b>
        </div>
      </div>
    </div>

    <div class="kpi yellow">
      <div class="kpi-content">
        <span>Vence 30 días</span>

        <div class="kpi-number-row">
          <i class="fa-regular fa-clock"></i>
          <b>${porVencer30}</b>
        </div>
      </div>
    </div>

    <div class="kpi orange">
      <div class="kpi-content">
        <span>Vence 15 días</span>

        <div class="kpi-number-row">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <b>${porVencer15}</b>
        </div>
      </div>
    </div>

    <div class="kpi bad">
      <div class="kpi-content">
        <span>No vigentes</span>

        <div class="kpi-number-row">
          <i class="fa-regular fa-circle-xmark"></i>
          <b>${noVigentes}</b>
        </div>
      </div>
    </div>

  `;
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

function getDocumentFolders(){

  const folders = new Set();

  archivosLocal.forEach(file => {

    const parts = file.webkitRelativePath.split("/");

    if(parts.length >= 2){
      folders.add(parts[1]);
    }

  });

  return [...folders].sort();
}

function populateDocumentFilter(){

  const select = document.getElementById("bulkDocFilter");

  if(!select) return;

  select.innerHTML = `
    <option value="">Todos los documentos</option>
  `;

  const folders = getDocumentFolders();

  folders.forEach(folder => {

    select.innerHTML += `
      <option value="${folder}">
        ${folder}
      </option>
    `;

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

  const win = window.open(url);

  win.onload = () => {
    win.focus();
    win.print();
  };

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

const bulkArea = document.getElementById("bulkAreaFilter");
const bulkGuardia = document.getElementById("bulkGuardiaFilter");

if(bulkArea){
  bulkArea.innerHTML =
    '<option value="">Todas las áreas</option>' +
    areas.map(a => `<option>${a}</option>`).join("");
}

if(bulkGuardia){
  bulkGuardia.innerHTML =
    '<option value="">Todas las guardias</option>' +
    guardias.map(g => `<option>${g}</option>`).join("");
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
  const pagination = document.getElementById("bulkPagination");

  if(!cont) return;

  const areaFilter =
    document.getElementById("bulkAreaFilter")?.value || "";

  const guardiaFilter =
    document.getElementById("bulkGuardiaFilter")?.value || "";

  const docFilter =
    document.getElementById("bulkDocFilter")?.value || "";

  let lista = trabajadores.filter(w => {

    if(areaFilter && w["ÁREA"] !== areaFilter){
      return false;
    }

    if(guardiaFilter && w.GUARDIA !== guardiaFilter){
      return false;
    }

    if(docFilter){
      const tieneDoc = buscarArchivo(w.DNI, docFilter);
      if(!tieneDoc) return false;
    }

    return true;
  });

  const totalPages =
    Math.ceil(lista.length / bulkPerPage);

  if(bulkCurrentPage > totalPages){
    bulkCurrentPage = 1;
  }

  const start =
    (bulkCurrentPage - 1) * bulkPerPage;

  const end =
    start + bulkPerPage;

  const paginated =
    lista.slice(start, end);

  let html = "";

  paginated.forEach(w => {

    html += `
      <div class="bulk-item">
        <input type="checkbox" value="${w.DNI}">

        <div>
          <b>${w.NOMBRES} ${w.APELLIDOS}</b><br>
          DNI: ${w.DNI}<br>
          ${w["ÁREA"]} - ${w.GUARDIA}
        </div>
      </div>
    `;
  });

  cont.innerHTML = html;

  document.querySelectorAll("#bulkList input")
  .forEach(ch => {
    ch.addEventListener("change", updateSelectedCounter);
  });

  updateSelectedCounter();

  renderBulkPagination(totalPages);
}

function renderBulkPagination(totalPages){

  const cont =
    document.getElementById("bulkPagination");

  if(!cont) return;

  let html = "";

  for(let i=1;i<=totalPages;i++){

    html += `
      <button
        class="${
          i === bulkCurrentPage ? "active-page" : ""
        }"
        onclick="changeBulkPage(${i})"
      >
        ${i}
      </button>
    `;
  }

  html += `
    <select id="bulkPerPageSelect">
      <option value="8">8</option>
      <option value="16" selected>16</option>
      <option value="24">24</option>
      <option value="50">50</option>
    </select>
  `;

  cont.innerHTML = html;

  document.getElementById("bulkPerPageSelect")
  .value = bulkPerPage;

  document.getElementById("bulkPerPageSelect")
  .addEventListener("change", function(){

    bulkPerPage = Number(this.value);
    bulkCurrentPage = 1;

    renderBulkList();

  });
}


function changeBulkPage(page){
  bulkCurrentPage = page;
  renderBulkList();
}


function updateSelectedCounter(){

  const counter =
    document.getElementById("selectedCounter");

  if(!counter) return;

  const total =
    document.querySelectorAll(
      "#bulkList input:checked"
    ).length;

  counter.textContent =
    `${total} seleccionados`;
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

  const tipo = document.getElementById("bulkDocFilter").value;

  if(!tipo){
    toast("Selecciona un documento.");
    return;
  }

  const checks = document.querySelectorAll("#bulkList input:checked");

  if(checks.length === 0){
    toast("Selecciona al menos un trabajador.");
    return;
  }

  checks.forEach(c => {
    abrirDocumento(c.value, tipo);
  });
}


function setupEvents(){

  /* ======================
     BUSCAR DNI
  ====================== */
  document.getElementById("btnBuscar")
  .addEventListener("click", searchWorker);

  document.getElementById("dniInput")
  .addEventListener("keydown", function(e){
    if(e.key === "Enter"){
      searchWorker();
    }
  });


  /* ======================
     TABS
  ====================== */
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


  /* ======================
     FILTROS CONTROL OPERATIVO
  ====================== */
  ["filterGuardia","filterArea","filterPermiso","filterEstado"]
  .forEach(id => {

    const el = document.getElementById(id);

    if(el){
      el.addEventListener("change", updateAll);
    }

  });


  /* ======================
     ACTUALIZAR DATA
  ====================== */
  document.getElementById("btnActualizar")
  .addEventListener("click", loadData);


  /* ======================
     FILTROS IMPRESIÓN
  ====================== */
  ["bulkAreaFilter","bulkGuardiaFilter","bulkDocFilter"]
  .forEach(id => {

    const el = document.getElementById(id);

    if(el){
      el.addEventListener("change", renderBulkList);
    }

  });


  /* ======================
     BOTÓN ABRIR DOCUMENTOS
  ====================== */
  document.getElementById("btnOpenSelected")
  .addEventListener("click", () => {

    const tipo =
      document.getElementById("bulkDocFilter").value;

    if(!tipo){
      alert("Selecciona tipo de documento");
      return;
    }

    const checks =
      document.querySelectorAll("#bulkList input:checked");

    if(checks.length === 0){
      alert("Selecciona al menos un trabajador");
      return;
    }

    checks.forEach(ch => {
      abrirDocumento(ch.value, tipo);
    });

  });


  /* ======================
     BOTÓN CARGAR CARPETA
  ====================== */
  document.getElementById("btnCarpeta")
  .addEventListener("click", () => {
    document.getElementById("folderInput").click();
  });


  /* ======================
     LEER CARPETA LOCAL
  ====================== */
  document.getElementById("folderInput")
  .addEventListener("change", (e) => {

    archivosLocal = Array.from(e.target.files);

    populateDocumentFilter();

    console.log("Archivos cargados:", archivosLocal);

    const nombreCarpeta =
      archivosLocal[0]?.webkitRelativePath.split("/")[0] || "";

    document.getElementById("folderStatus").innerHTML = `
      <i class="fa-solid fa-folder-open"></i>
      <div class="status-text">
        <strong>Carpeta cargada</strong>
        <span>${nombreCarpeta}</span>
      </div>
    `;

    if(currentWorker){
      renderWorkerPerms(currentWorker);
    }

    renderBulkList();

  });


  /* ======================
     SELECCIONAR TODO
  ====================== */
  document.getElementById("btnSelectAll")
  .addEventListener("click", () => {

    const checks =
      document.querySelectorAll(
        "#bulkList input[type='checkbox']"
      );

    const allChecked =
      [...checks].every(c => c.checked);

    checks.forEach(c => c.checked = !allChecked);
     updateSelectedCounter();

  });


  /* ======================
     IMPRIMIR SELECCIONADOS
  ====================== */
  document.getElementById("btnPrintSelected")
  .addEventListener("click", () => {

    const tipo =
      document.getElementById("bulkDocFilter").value;

    if(!tipo){
      alert("Selecciona tipo de documento");
      return;
    }

    const seleccionados =
      document.querySelectorAll("#bulkList input:checked");

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
