#!/usr/bin/env bash
# UAT smoke test: ejecuta el flujo completo de las HU contra la app desplegada.
# Requires: AKADMIN_TOKEN, RESPONSABLE_TOKEN, EJECUTOR_TOKEN env vars
#           (use ops/mint-test-tokens.sh para generarlos).
#           API env var (default: https://demo.breisner.info/abax-gantt)
#
# Exit 0 si pasan todos los checks, 1 si alguno falla.
# Salida verbosa por defecto; use SILENT=1 para solo PASS/FAIL.

set -uo pipefail

: "${AKADMIN_TOKEN:?AKADMIN_TOKEN no definido — corre source <(ops/mint-test-tokens.sh)}"
: "${RESPONSABLE_TOKEN:?RESPONSABLE_TOKEN no definido}"
: "${EJECUTOR_TOKEN:?EJECUTOR_TOKEN no definido}"
API="${API:-https://demo.breisner.info/abax-gantt}"
SILENT="${SILENT:-0}"

PASS=0
FAIL=0
FAILED_TESTS=()

color() { if [[ -t 1 ]]; then printf "\033[%sm%s\033[0m" "$1" "$2"; else printf "%s" "$2"; fi; }
log()   { [[ $SILENT -eq 0 ]] && echo "  $*"; }
title() { echo; echo "$(color '1;36' "▶ $*")"; }
ok()    { PASS=$((PASS+1)); echo "  $(color '1;32' '✓') $1"; }
fail()  { FAIL=$((FAIL+1)); FAILED_TESTS+=("$1"); echo "  $(color '1;31' '✗') $1${2:+ — $2}"; }

# Helpers
req() {
  # usage: req METHOD URL TOKEN [BODY]
  local method=$1 url=$2 token=$3 body=${4:-}
  local args=(-sk -m 15 -o /tmp/uat-body.json -w "%{http_code}" -H "Authorization: Bearer $token" -X "$method")
  [[ -n "$body" ]] && args+=(-H "Content-Type: application/json" -d "$body")
  curl "${args[@]}" "$url" 2>/dev/null
}

assert_status() {
  local label=$1 expected=$2 got=$3
  if [[ "$got" == "$expected" ]]; then ok "$label (HTTP $got)"; return 0
  else fail "$label" "esperado HTTP $expected, obtenido $got: $(cat /tmp/uat-body.json 2>/dev/null | head -c 200)"; return 1
  fi
}

extract() { python3 -c "import sys,json; d=json.load(open('/tmp/uat-body.json')); $1" 2>/dev/null || echo ""; }

# ════════════════════════════════════════════════════════════════
title "0. Health"
status=$(req GET "$API/api/health" "$AKADMIN_TOKEN")
assert_status "GET /api/health responde 200" 200 "$status"

# ════════════════════════════════════════════════════════════════
title "1. Auth"
status=$(req GET "$API/api/projects" "invalid-token")
assert_status "Token inválido → 401" 401 "$status"
status=$(curl -sk -m 10 -o /dev/null -w "%{http_code}" "$API/api/projects")
assert_status "Sin token → 401" 401 "$status"

# ════════════════════════════════════════════════════════════════
title "2. Perfiles registrados"
status=$(req GET "$API/api/users" "$AKADMIN_TOKEN")
assert_status "Admin lista usuarios" 200 "$status"
status=$(req GET "$API/api/users" "$RESPONSABLE_TOKEN")
assert_status "Responsable lista usuarios" 200 "$status"

# ════════════════════════════════════════════════════════════════
title "3. CRUD Proyecto / WBS"
ts=$(date +%s)
status=$(req POST "$API/api/projects" "$AKADMIN_TOKEN" "{\"name\":\"UAT-$ts\"}")
assert_status "Admin crea proyecto" 201 "$status"
PROJ_ID=$(extract "print(d['data']['id'])")
ROOT_ID=$(extract "print(d['data']['root_node_id'])")
log "Proyecto: $PROJ_ID  raíz: $ROOT_ID"

status=$(req POST "$API/api/wbs" "$AKADMIN_TOKEN" "{\"parent_id\":\"$ROOT_ID\",\"name\":\"Fase 1\",\"type\":\"stage\"}")
assert_status "Crear etapa" 201 "$status"
STAGE_ID=$(extract "print(d['data']['id'])")

status=$(req POST "$API/api/wbs" "$AKADMIN_TOKEN" "{\"parent_id\":\"$STAGE_ID\",\"name\":\"Tarea A\",\"type\":\"task\",\"start_date\":\"2026-06-01\",\"end_date\":\"2026-06-05\"}")
assert_status "Crear tarea con fechas" 201 "$status"
TASK_A=$(extract "print(d['data']['id'])")

status=$(req POST "$API/api/wbs" "$AKADMIN_TOKEN" "{\"parent_id\":\"$STAGE_ID\",\"name\":\"Tarea Backlog\",\"type\":\"task\"}")
assert_status "Crear tarea sin fecha (backlog)" 201 "$status"
TASK_BL=$(extract "print(d['data']['id'])")

status=$(req POST "$API/api/wbs" "$AKADMIN_TOKEN" "{\"parent_id\":\"$STAGE_ID\",\"name\":\"Hito\",\"type\":\"milestone\",\"start_date\":\"2026-06-15\",\"end_date\":\"2026-06-15\"}")
assert_status "Crear hito" 201 "$status"

# Update inline
status=$(req PATCH "$API/api/wbs/$TASK_A" "$AKADMIN_TOKEN" '{"name":"Tarea A v2"}')
assert_status "PATCH renombrar tarea" 200 "$status"

# ════════════════════════════════════════════════════════════════
title "4. Backlog y schedule"
status=$(req GET "$API/api/backlog?project_id=$PROJ_ID" "$AKADMIN_TOKEN")
assert_status "GET backlog" 200 "$status"

status=$(req PATCH "$API/api/wbs/schedule/$TASK_BL" "$AKADMIN_TOKEN" '{"start_date":"2026-07-01","end_date":"2026-07-05"}')
assert_status "Programar tarea desde backlog" 200 "$status"

status=$(req PATCH "$API/api/wbs/schedule/$TASK_BL" "$AKADMIN_TOKEN" '{"unschedule":true}')
assert_status "Devolver tarea al backlog" 200 "$status"

# ════════════════════════════════════════════════════════════════
title "5. Dependencias"
status=$(req POST "$API/api/wbs" "$AKADMIN_TOKEN" "{\"parent_id\":\"$STAGE_ID\",\"name\":\"Tarea B\",\"type\":\"task\",\"start_date\":\"2026-06-10\",\"end_date\":\"2026-06-15\"}")
assert_status "Crear Tarea B" 201 "$status"
TASK_B=$(extract "print(d['data']['id'])")

status=$(req POST "$API/api/dependencies" "$AKADMIN_TOKEN" "{\"predecessor_id\":\"$TASK_A\",\"successor_id\":\"$TASK_B\",\"type\":\"FS\"}")
assert_status "Crear dependencia FS" 201 "$status"
DEP_ID=$(extract "print(d['data']['id'])")

status=$(req GET "$API/api/dependencies?project_id=$PROJ_ID" "$AKADMIN_TOKEN")
assert_status "Listar dependencias" 200 "$status"

status=$(req DELETE "$API/api/dependencies/$DEP_ID" "$AKADMIN_TOKEN")
assert_status "Eliminar dependencia" 200 "$status"

# ════════════════════════════════════════════════════════════════
title "6. Asignaciones y permisos"
EJ_PROFILE=$(curl -sk -m 10 -H "Authorization: Bearer $AKADMIN_TOKEN" "$API/api/users" | python3 -c "import sys,json; print([u['id'] for u in json.load(sys.stdin)['data'] if 'ejecutor' in u['email']][0])")
RESP_PROFILE=$(curl -sk -m 10 -H "Authorization: Bearer $AKADMIN_TOKEN" "$API/api/users" | python3 -c "import sys,json; print([u['id'] for u in json.load(sys.stdin)['data'] if 'responsable' in u['email']][0])")

status=$(req POST "$API/api/assignees" "$AKADMIN_TOKEN" "{\"task_id\":\"$TASK_A\",\"user_id\":\"$EJ_PROFILE\"}")
assert_status "Asignar ejecutor" 201 "$status"
ASSIGN_ID=$(extract "print(d['data']['id'])")

status=$(req PATCH "$API/api/wbs/$STAGE_ID" "$AKADMIN_TOKEN" "{\"responsible_id\":\"$RESP_PROFILE\"}")
assert_status "Designar responsable de etapa" 200 "$status"

# Permisos: ejecutor NO puede editar nombre
status=$(req PATCH "$API/api/wbs/$TASK_A" "$EJECUTOR_TOKEN" '{"name":"hackeado"}')
assert_status "Ejecutor NO puede renombrar tarea (403)" 403 "$status"

# Permisos: ejecutor SÍ puede reportar avance
status=$(req PATCH "$API/api/wbs/progress/$TASK_A" "$EJECUTOR_TOKEN" '{"progress":0.4}')
assert_status "Ejecutor reporta avance" 200 "$status"

# Permisos: ejecutor SÍ puede registrar horas
status=$(req POST "$API/api/timesheet" "$EJECUTOR_TOKEN" "{\"task_id\":\"$TASK_A\",\"hours\":1.5,\"notes\":\"trabajo\"}")
assert_status "Ejecutor registra horas en su tarea" 201 "$status"

# Permisos: responsable puede editar su etapa
status=$(req PATCH "$API/api/wbs/$STAGE_ID" "$RESPONSABLE_TOKEN" '{"description":"Editado por responsable"}')
assert_status "Responsable edita su etapa" 200 "$status"

# Permisos: responsable NO puede editar el proyecto raíz (solo akadmin)
status=$(req PATCH "$API/api/projects/$PROJ_ID" "$RESPONSABLE_TOKEN" '{"description":"hack"}')
assert_status "Responsable NO puede editar proyecto (403)" 403 "$status"

# Permisos: ejecutor NO puede crear dependencias
status=$(req POST "$API/api/dependencies" "$EJECUTOR_TOKEN" "{\"predecessor_id\":\"$TASK_A\",\"successor_id\":\"$TASK_B\",\"type\":\"FS\"}")
assert_status "Ejecutor NO crea dependencia (403)" 403 "$status"

# Eliminar asignación
status=$(req DELETE "$API/api/assignees/$ASSIGN_ID" "$AKADMIN_TOKEN")
assert_status "Eliminar asignación" 200 "$status"

# ════════════════════════════════════════════════════════════════
title "7. Filtros WBS"
status=$(req GET "$API/api/wbs?my_tasks=true" "$EJECUTOR_TOKEN")
assert_status "Filtro my_tasks (ejecutor)" 200 "$status"
status=$(req GET "$API/api/wbs?search=Tarea" "$AKADMIN_TOKEN")
assert_status "Filtro búsqueda" 200 "$status"
status=$(req GET "$API/api/wbs?unscheduled=true" "$AKADMIN_TOKEN")
assert_status "Filtro backlog" 200 "$status"
status=$(req GET "$API/api/wbs?status=en_progreso" "$AKADMIN_TOKEN")
assert_status "Filtro status" 200 "$status"
status=$(req GET "$API/api/wbs?project_id=$PROJ_ID" "$AKADMIN_TOKEN")
assert_status "Filtro project_id" 200 "$status"

# ════════════════════════════════════════════════════════════════
title "8. KPI / Summary / Reports (sumas numéricas correctas)"
status=$(req GET "$API/api/kpi" "$AKADMIN_TOKEN")
assert_status "GET /api/kpi" 200 "$status"
# Validar que budget.total es número
is_num=$(extract "print('OK' if isinstance(d['data']['budget']['total'], (int, float)) else 'FAIL')")
[[ "$is_num" == "OK" ]] && ok "budget.total es numérico" || fail "budget.total es numérico" "obtuvo: $is_num"

status=$(req GET "$API/api/summary" "$AKADMIN_TOKEN")
assert_status "GET /api/summary" 200 "$status"

status=$(req GET "$API/api/reports/$PROJ_ID" "$AKADMIN_TOKEN")
assert_status "GET /api/reports/{id} (admin)" 200 "$status"

status=$(req GET "$API/api/reports/$PROJ_ID" "$EJECUTOR_TOKEN")
assert_status "GET /api/reports/{id} ejecutor (403)" 403 "$status"

# ════════════════════════════════════════════════════════════════
title "9. Export"
status=$(req GET "$API/api/export/$PROJ_ID?format=json" "$AKADMIN_TOKEN")
assert_status "Export JSON" 200 "$status"
status=$(req GET "$API/api/export/$PROJ_ID?format=csv" "$AKADMIN_TOKEN")
assert_status "Export CSV" 200 "$status"
status=$(req GET "$API/api/export/$PROJ_ID?format=pdf" "$AKADMIN_TOKEN")
assert_status "Export PDF (501 — diferido)" 501 "$status"

# ════════════════════════════════════════════════════════════════
title "10. Adjuntos"
echo "test" > /tmp/uat-attach.txt
status=$(curl -sk -m 15 -o /tmp/uat-body.json -w "%{http_code}" \
  -H "Authorization: Bearer $AKADMIN_TOKEN" \
  -F "project_id=$PROJ_ID" -F "file=@/tmp/uat-attach.txt" \
  "$API/api/attachments")
assert_status "Subir adjunto" 201 "$status"
ATT_ID=$(extract "print(d['data']['id'])")

status=$(req GET "$API/api/attachments?project_id=$PROJ_ID" "$AKADMIN_TOKEN")
assert_status "Listar adjuntos" 200 "$status"

# Ejecutor NO puede subir adjunto al proyecto
status=$(curl -sk -m 15 -o /tmp/uat-body.json -w "%{http_code}" \
  -H "Authorization: Bearer $EJECUTOR_TOKEN" \
  -F "project_id=$PROJ_ID" -F "file=@/tmp/uat-attach.txt" \
  "$API/api/attachments")
assert_status "Ejecutor NO sube adjunto (403)" 403 "$status"

status=$(req DELETE "$API/api/attachments/$ATT_ID" "$AKADMIN_TOKEN")
assert_status "Eliminar adjunto" 200 "$status"

# ════════════════════════════════════════════════════════════════
title "11. Admin: usuarios + tipos de proyecto"
INV_EMAIL="invitado-$(date +%s)@test.com"
status=$(req POST "$API/api/admin/users" "$AKADMIN_TOKEN" "{\"email\":\"$INV_EMAIL\",\"full_name\":\"Invitado UAT\"}")
assert_status "Admin invita usuario" 201 "$status"
INV_ID=$(extract "print(d['data']['id'])")

status=$(req PUT "$API/api/admin/users/$INV_ID" "$AKADMIN_TOKEN" '{"status":"inactive"}')
assert_status "Admin desactiva usuario" 200 "$status"

status=$(req POST "$API/api/admin/users" "$RESPONSABLE_TOKEN" '{"email":"x@x.com","full_name":"x"}')
assert_status "Responsable NO invita usuario (403)" 403 "$status"

status=$(req POST "$API/api/admin/project-types" "$AKADMIN_TOKEN" '{"name":"UAT Type","color":"#6366f1"}')
assert_status "Admin crea tipo de proyecto" 201 "$status"
PT_ID=$(extract "print(d['data']['id'])")

status=$(req PUT "$API/api/admin/project-types/$PT_ID" "$AKADMIN_TOKEN" '{"name":"UAT Type v2"}')
assert_status "Admin actualiza tipo de proyecto" 200 "$status"

# ════════════════════════════════════════════════════════════════
title "12. DELETE WBS / archivar proyecto"
status=$(req DELETE "$API/api/wbs/$TASK_BL" "$AKADMIN_TOKEN")
assert_status "Eliminar tarea backlog" 200 "$status"

status=$(req DELETE "$API/api/projects/$PROJ_ID" "$AKADMIN_TOKEN")
assert_status "Archivar proyecto" 200 "$status"

# ════════════════════════════════════════════════════════════════
title "Resultado"
TOTAL=$((PASS+FAIL))
if [[ $FAIL -eq 0 ]]; then
  echo
  echo "$(color '1;32' "✓ TODOS LOS CHECKS PASARON ($PASS/$TOTAL)")"
  exit 0
else
  echo
  echo "$(color '1;31' "✗ $FAIL/$TOTAL CHECKS FALLARON")"
  echo "Fallos:"
  for t in "${FAILED_TESTS[@]}"; do echo "  • $t"; done
  exit 1
fi
