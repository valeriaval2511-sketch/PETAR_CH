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
     toast("No encontrado.");
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
  let porVencer = 0;
  let noVigentes = 0;

  PERMISOS.forEach(p => {

    if(!p.vigenciaCol) return;

    const vig = parseDate(get(worker,p.vigenciaCol));
    const st = statusFromVigencia(vig);

    if(st.estado === "VIGENTE"){
      vigentes++;
    }
    else if(st.estado === "POR VENCER"){
      porVencer++;
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

    <div class="kpi warn">
      <div class="kpi-content">
        <span>Por vencer</span>

        <div class="kpi-number-row">
          <i class="fa-regular fa-clock"></i>
          <b>${porVencer}</b>
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
