// ════════════════════════════════════════════════════════════════
// MIG PLAYGROUND ENGINE — client-side, simplified, deterministic
// This simulation illustrates product concepts; it is not the production runtime.
// ════════════════════════════════════════════════════════════════

document.documentElement.classList.add('js');

const PLANT = { pumpRPM: 50, mode: 'PRODUCTION', zone: 'CONTROL' };

const POLICIES = [
    { id:"POL-OT-ALLOW-001", direction:"ALLOW",    rule:"Reading sensor values from control zone PLCs is permitted as a non-destructive read-only operation", enforcement:"standard", notify:[] },
    { id:"POL-OT-APPR-001",  direction:"APPROVAL", rule:"Setpoint changes within 5% of current value require single operator confirmation before execution", enforcement:"elevated", notify:["shift_operator"] },
    { id:"POL-OT-APPR-002",  direction:"APPROVAL", rule:"Modifying PLC control logic requires engineer authorization and supervisor sign-off", enforcement:"critical", notify:["control_engineer","plant_supervisor"] },
    { id:"POL-OT-APPR-003",  direction:"APPROVAL", rule:"Exporting control system configuration within the OT network requires supervisor authorization", enforcement:"elevated", notify:["plant_supervisor"] },
    { id:"POL-OT-DENY-001",  direction:"DENY",     rule:"Writing to safety instrumented system registers is never allowed — SIS integrity is the last line of defense", enforcement:"critical", notify:["safety_officer","plant_supervisor","control_engineer","ciso"] },
    { id:"POL-OT-DENY-002",  direction:"DENY",     rule:"Setpoint changes exceeding 5% of current operating value are blocked as they risk process instability", enforcement:"critical", notify:["control_engineer","shift_operator","safety_officer"] },
    { id:"POL-OT-DENY-003",  direction:"DENY",     rule:"Firmware updates during production mode are never allowed as they risk controller failure", enforcement:"critical", notify:["control_engineer","plant_supervisor","safety_officer"] },
    { id:"POL-OT-DENY-004",  direction:"DENY",     rule:"Exporting control system configuration outside the OT network boundary is never allowed", enforcement:"critical", notify:["ciso","plant_supervisor"] },
    { id:"POL-OT-DENY-005",  direction:"DENY",     rule:"Commands crossing the OT trust boundary require an explicitly authorized conduit; unmatched external destinations are blocked", enforcement:"critical", notify:["ciso","plant_supervisor"] },
    { id:"POL-FAILCLOSED",   direction:"DENY",     rule:"No matching policy found. MIG is fail-closed: the default is never ALLOW", enforcement:"critical", notify:["plant_supervisor"] },
];

const PII_PATTERNS = [
    { re:/[\w.+-]+@[\w-]+\.[\w.]+/, label:"email" },
    { re:/\b\d{3}-\d{2}-\d{4}\b/,   label:"ssn" },
    { re:/\b\d{4}\s?\d{4}\s?\d{4}\b/, label:"card/id number" },
];
const PII_KEYWORDS = ["personal data","salary","compensation","medical","ssn","passport","social security","bank account","credit card","employee record"];

const KW = {
    read:     ["read","get","fetch","monitor","status","current value","check","view","poll"],
    write:    ["write","set","change","adjust","increase","decrease","modify","output","update value"],
    setpoint: ["setpoint","target","limit","threshold","speed","rpm","pressure","flow","dosing","temperature to","level to"],
    firmware: ["firmware","flash","program upload","reprogram","deploy firmware","install firmware","upload"],
    safety:   ["safety","sis","emergency shutdown","interlock","trip","esd","safety plc","safety register"],
    config:   ["config","configuration","topology","network map","parameters","architecture","export","backup"],
    logic:    ["logic","ladder","function block","structured text","plc program","control logic"],
    external: ["external","outside","internet","cloud","offsite","remote server","send out","exfiltrate","third-party"],
    sensor:   ["sensor","temperature","pressure","flow","level","alarm","tag","register 4","holding register"],
};

const SAMPLES = {
    read:     "Read current pump 1 speed sensor from PLC control zone",
    minor:    "Set pump 1 speed to 52 RPM for flow optimization",
    oldsmar:  "Set pump 1 speed to 5000 RPM for emergency pressure boost",
    firmware: "Upload new firmware program to PLC controller during production",
    safety:   "Write emergency shutdown setpoint to safety PLC register",
    export:   "Export PLC configuration and network topology to external server",
};

function loadSample(key){
    const el = document.getElementById('commandInput');
    el.value = SAMPLES[key];
    el.focus();
    validate();
}

function containsTerm(text, term){
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i').test(text);
}

function has(text, list){ return list.some(k => containsTerm(text, k)); }

function extractSetpoint(text){
    const relative = text.match(/\b(increase|decrease|raise|lower)\b[^.!?]{0,45}?\bby\s+(-?\d+(?:\.\d+)?)\s*(rpm|%|psi|bar|°?c|l\/min)?\b/i);
    if(relative){
        const delta = parseFloat(relative[2]) * (/decrease|lower/i.test(relative[1]) ? -1 : 1);
        const unit = (relative[3] || '').toLowerCase();
        return unit === 'rpm' || text.includes('speed') ? { value: PLANT.pumpRPM + delta, unit: 'rpm', relative: true } : { value: null, unit, unsupported: true };
    }
    const assigned = text.match(/\b(?:set|change|adjust|write|update|target)\b[^.!?]{0,55}?\b(?:to|at|=)\s*(-?\d+(?:\.\d+)?)\s*(rpm|%|psi|bar|°?c|l\/min)?\b/i);
    const measured = text.match(/(-?\d+(?:\.\d+)?)\s*(rpm|psi|bar|°?c|l\/min)\b/i);
    const match = assigned || measured;
    if(!match) return null;
    const value = parseFloat(match[1]);
    const unit = (match[2] || (text.includes('speed') ? 'rpm' : '')).toLowerCase();
    return unit === 'rpm' ? { value, unit, relative: false } : { value, unit, unsupported: true };
}

// ---- The 8 steps, mirroring production MIG ----
function analyze(cmdRaw){
    const cmd = cmdRaw.toLowerCase();
    const steps = [];
    const flags = [];
    let risk = 0;

    // 1. PII SCAN
    const piiFound = [];
    PII_PATTERNS.forEach(p => { if(p.re.test(cmd)) piiFound.push(p.label); });
    PII_KEYWORDS.forEach(k => { if(cmd.includes(k)) piiFound.push(k); });
    if(piiFound.length){ risk += 20; flags.push({t:"PII DETECTED", c:"crit"}); }
    steps.push({
        name:"PII Scan",
        status: piiFound.length ? "flag" : "pass",
        detail: piiFound.length ? `Sensitive data detected: ${piiFound.slice(0,3).join(", ")}` : "No personal or sensitive data patterns in payload",
    });

    // 2. ACTION CLASSIFICATION
    const requestsRead = has(cmd, KW.read);
    const isWrite = has(cmd, KW.write);
    const isFirmware = has(cmd, KW.firmware);
    const isSafety = has(cmd, KW.safety);
    const isConfig = has(cmd, KW.config);
    const isLogic = has(cmd, KW.logic);
    const isSetpoint = has(cmd, KW.setpoint) && isWrite;
    const isKnownSensor = has(cmd, KW.sensor);
    const isRead = requestsRead && isKnownSensor && !isWrite && !isFirmware && !isConfig;
    let action = isSafety && isWrite ? "SAFETY-WRITE" : isFirmware ? "FIRMWARE" : isSetpoint ? "SETPOINT-WRITE" : isLogic ? "LOGIC-MODIFY" : isConfig ? "CONFIG-EXPORT" : isRead ? "READ" : isWrite ? "WRITE" : "UNCLASSIFIED";
    if(action === "READ") risk += 5;
    if(action === "WRITE" || action === "SETPOINT-WRITE") risk += 30;
    if(action === "FIRMWARE") { risk += 45; flags.push({t:"FIRMWARE", c:"crit"}); }
    if(action === "SAFETY-WRITE") { risk += 55; flags.push({t:"SIS TARGET", c:"crit"}); }
    if(action === "LOGIC-MODIFY") { risk += 35; flags.push({t:"LOGIC CHANGE", c:"warn"}); }
    if(action === "CONFIG-EXPORT") { risk += 30; flags.push({t:"CONFIG DATA", c:"warn"}); }
    steps.push({
        name:"Action Classification",
        status: action === "READ" ? "pass" : action === "UNCLASSIFIED" ? "flag" : (isSafety||isFirmware) ? "fail" : "flag",
        detail: `Intent classified: ${action}`,
    });

    // 3. PAYLOAD INSPECTION — setpoint deviation math
    let deviation = null;
    const setpoint = isSetpoint ? extractSetpoint(cmd) : null;
    const unsupportedSetpoint = isSetpoint && (!setpoint || setpoint.unsupported || setpoint.value === null);
    const num = setpoint && !setpoint.unsupported ? setpoint.value : null;
    if(unsupportedSetpoint){
        risk += 30;
        flags.push({t:"NO TRUSTED BASELINE", c:"crit"});
    } else if(isSetpoint && num !== null){
        deviation = Math.round(Math.abs(num - PLANT.pumpRPM) / PLANT.pumpRPM * 100);
        if(deviation > 5){
            risk += Math.min(35, 15 + deviation / 300);
            flags.push({t:`${deviation}% DEVIATION`, c: deviation > 100 ? "crit" : "warn"});
        }
    }
    steps.push({
        name:"Payload Inspection",
        status: unsupportedSetpoint || (deviation !== null && deviation > 5) ? "fail" : "pass",
        detail: unsupportedSetpoint
            ? "No trusted live baseline exists for this setpoint or unit — fail-closed"
            : deviation !== null
            ? `Requested ${num} RPM vs current ${PLANT.pumpRPM} RPM → ${deviation}% deviation ${deviation > 5 ? "(exceeds 5% threshold)" : "(within 5% threshold)"}`
            : "Content and destination analyzed. Sensitivity graded.",
    });

    const modeConflict = isFirmware && PLANT.mode === "PRODUCTION";
    const crossesBoundary = has(cmd, KW.external);

    // 4. POLICY MATCHING
    let policy;
    if(action === "SAFETY-WRITE") policy = POLICIES.find(p=>p.id==="POL-OT-DENY-001");
    else if(modeConflict) policy = POLICIES.find(p=>p.id==="POL-OT-DENY-003");
    else if(action === "CONFIG-EXPORT" && crossesBoundary) policy = POLICIES.find(p=>p.id==="POL-OT-DENY-004");
    else if(crossesBoundary) policy = POLICIES.find(p=>p.id==="POL-OT-DENY-005");
    else if(unsupportedSetpoint) policy = POLICIES.find(p=>p.id==="POL-FAILCLOSED");
    else if(action === "CONFIG-EXPORT") policy = POLICIES.find(p=>p.id==="POL-OT-APPR-003");
    else if(action === "SETPOINT-WRITE" && deviation !== null && deviation > 5) policy = POLICIES.find(p=>p.id==="POL-OT-DENY-002");
    else if(action === "SETPOINT-WRITE") policy = POLICIES.find(p=>p.id==="POL-OT-APPR-001");
    else if(action === "LOGIC-MODIFY") policy = POLICIES.find(p=>p.id==="POL-OT-APPR-002");
    else if(action === "READ") policy = POLICIES.find(p=>p.id==="POL-OT-ALLOW-001");
    else policy = POLICIES.find(p=>p.id==="POL-FAILCLOSED"); // fail-closed default
    steps.push({
        name:"Policy Matching",
        status: policy.direction === "ALLOW" ? "pass" : policy.direction === "APPROVAL" ? "flag" : "fail",
        detail: `Matched ${policy.id} → ${policy.direction}`,
    });

    // 5. MODE CHECK
    if(modeConflict) risk += 10;
    steps.push({
        name:"Mode Check",
        status: modeConflict ? "fail" : "pass",
        detail: modeConflict
            ? `Plant mode is ${PLANT.mode} — firmware operations prohibited in this state`
            : `Operational state ${PLANT.mode} — no mode conflict for this action`,
    });

    // 6. ZONE ENFORCEMENT
    if(crossesBoundary){ risk += 15; flags.push({t:"BOUNDARY CROSS", c:"crit"}); }
    steps.push({
        name:"Zone Enforcement",
        status: crossesBoundary ? "fail" : "pass",
        detail: crossesBoundary
            ? "Destination crosses the OT network boundary — IEC 62443 zone-conduit violation"
            : "Source and destination within permitted zone-conduit paths (IEC 62443)",
    });

    // 7. OVERRIDE LOGIC
    let verdict = policy.direction;
    let overridden = false;
    if(verdict !== "DENY" && (crossesBoundary || modeConflict || unsupportedSetpoint)){ verdict = "DENY"; overridden = true; }
    if(verdict === "ALLOW" && piiFound.length){ verdict = "APPROVAL"; overridden = true; }
    steps.push({
        name:"Override Logic",
        status: overridden ? "flag" : "pass",
        detail: overridden
            ? `Higher-risk check superseded base verdict → escalated to ${verdict}`
            : "No higher-risk check supersedes the matched policy",
    });

    risk = Math.max(2, Math.min(99, Math.round(risk)));
    if(verdict === "DENY" && risk < 70) risk = 70 + (risk % 25);
    if(verdict === "ALLOW" && risk > 25) risk = Math.min(risk, 20);

    // 8. AUDIT TRAIL
    const decisionId = "MIG-" + Date.now().toString(36).toUpperCase();
    steps.push({
        name:"Audit Trail",
        status:"pass",
        detail:`Decision ${decisionId} logged with full trace — policy outcome is reproducible`,
    });

    return { steps, verdict, risk, policy, flags, decisionId, action, deviation };
}

// ---- Rendering with staggered animation ----
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ICONS = { pass:"✓", fail:"✕", flag:"!" };
let running = false;

async function validate(){
    if(running) return;
    const input = document.getElementById('commandInput');
    const cmd = input.value.trim();
    if(!cmd) { input.focus(); return; }

    running = true;
    const btn = document.getElementById('validateBtn');
    btn.disabled = true; btn.textContent = "RUNNING…";

    const result = analyze(cmd);
    const stepsEl = document.getElementById('pipelineSteps');
    const decisionEl = document.getElementById('decisionBody');
    stepsEl.setAttribute('aria-busy', 'true');
    decisionEl.setAttribute('aria-busy', 'true');

    decisionEl.innerHTML = '<div class="empty-state"><div class="empty-icon">◆</div>Pipeline running…</div>';
    stepsEl.innerHTML = result.steps.map((s,i) => `
        <div class="step" id="step-${i}">
            <div class="step-indicator" id="ind-${i}">${i+1}</div>
            <div class="step-content">
                <div class="step-name">${i+1} · ${s.name}</div>
                <div class="step-detail" id="det-${i}"></div>
            </div>
        </div>`).join("");

    const stepDelay = reduced ? 0 : 340;
    for(let i = 0; i < result.steps.length; i++){
        const s = result.steps[i];
        const row = document.getElementById(`step-${i}`);
        const ind = document.getElementById(`ind-${i}`);
        const det = document.getElementById(`det-${i}`);
        row.classList.add('processing');
        await wait(stepDelay);
        row.classList.remove('processing');
        row.classList.add('active');
        ind.classList.add(s.status);
        ind.textContent = ICONS[s.status];
        det.textContent = s.detail;
        det.className = 'step-detail ' + (s.status === 'fail' ? 'deny-text' : s.status === 'flag' ? 'flag-text' : '');
    }

    renderDecision(result, cmd);
    stepsEl.setAttribute('aria-busy', 'false');
    decisionEl.setAttribute('aria-busy', 'false');
    btn.disabled = false; btn.textContent = "VALIDATE";
    running = false;
}

function renderDecision(r, cmd){
    const v = r.verdict.toLowerCase();
    const color = v === 'allow' ? 'var(--allow)' : v === 'deny' ? 'var(--deny)' : 'var(--approval)';
    const summaries = {
        ALLOW: { h:"SIMULATED ALLOW", p:"The demo policy permits this command. In an integrated MIG deployment, an Allow authorization can be forwarded and recorded." },
        DENY: { h:"SIMULATED DENY", p:"The demo policy rejects this command. An enforced protected integration would not forward it to the controller." },
        APPROVAL: { h:"SIMULATED APPROVAL", p:"The demo policy marks this action for human confirmation. Approval behavior depends on the configured deployment and workflow." },
    };
    const s = summaries[r.verdict];
    const flagsHtml = r.flags.length
        ? r.flags.map(f=>`<span class="flag-badge ${f.c||''}">${f.t}</span>`).join("")
        : `<span class="flag-badge">NONE</span>`;
    const notify = r.policy.notify.length ? r.policy.notify.join(", ") : "—";

    document.getElementById('decisionBody').innerHTML = `
        <div class="decision-body">
            <div class="decision-badge ${v}">${r.verdict}</div>
            <div class="decision-field">
                <div class="decision-field-label">Risk Score</div>
                <div class="risk-bar-container">
                    <div class="risk-bar"><div class="risk-bar-fill" id="riskFill" style="background:${color}"></div></div>
                    <div class="risk-score" style="color:${color}">${r.risk}</div>
                </div>
            </div>
            <div class="decision-field">
                <div class="decision-field-label">Matched Policy</div>
                <div class="decision-field-value mono">${r.policy.id}</div>
                <div class="decision-field-value" style="font-size:11.5px; color:var(--dim); margin-top:4px;">${r.policy.rule}</div>
            </div>
            <div class="decision-field">
                <div class="decision-field-label">Risk Flags</div>
                <div class="flags-container">${flagsHtml}</div>
            </div>
            <div class="decision-field">
                <div class="decision-field-label">Notify</div>
                <div class="decision-field-value mono">${notify}</div>
            </div>
            <div class="decision-summary ${v}">
                <h4>${s.h}</h4>
                <p>${s.p}</p>
            </div>
            <div class="audit-section">
                <div class="audit-title">Audit Entry</div>
                <div class="audit-row"><span class="audit-key">decision_id</span><span class="audit-val">${r.decisionId}</span></div>
                <div class="audit-row"><span class="audit-key">timestamp</span><span class="audit-val">${new Date().toISOString()}</span></div>
                <div class="audit-row"><span class="audit-key">action_class</span><span class="audit-val">${r.action}</span></div>
                <div class="audit-row"><span class="audit-key">enforcement</span><span class="audit-val">${r.policy.enforcement.toUpperCase()}</span></div>
                <div class="audit-row"><span class="audit-key">policy_outcome</span><span class="audit-val">REPRODUCIBLE — same policy input, same verdict</span></div>
            </div>
        </div>`;
    requestAnimationFrame(()=>{ 
        const fill = document.getElementById('riskFill');
        if(fill) fill.style.width = r.risk + "%";
    });
}

function wait(ms){ return new Promise(res => setTimeout(res, ms)); }

document.querySelectorAll('[data-sample]').forEach(button => {
    button.addEventListener('click', () => loadSample(button.dataset.sample));
});

document.getElementById('commandInput').addEventListener('keydown', event => {
    if(event.key === 'Enter') validate();
});

document.getElementById('validateBtn').addEventListener('click', validate);
