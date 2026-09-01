import { Router, type IRouter } from "express";
import { asyncHandler }         from "../../middleware/asyncHandler.js";
import { requireServiceToken, requirePermission } from "../../middleware/auth.js";
import { simulationInputSchema } from "@costsim/validation";
import { db }                   from "../../db/client.js";
import {
  runSimulation, computeDropdowns, computeEligibilityGrid,
  computeCombinationsGrid, computeInteragencyGrid,
} from "./engine.js";
import * as T from "../../db/schema.js";
import { eq, or, isNull } from "drizzle-orm";

export const costingRouter: IRouter = Router();
costingRouter.use(requireServiceToken);

// ---------------------------------------------------------------------------
// Internal: load all source tables scoped to an enterprise
// ---------------------------------------------------------------------------

async function loadDataSources(enterpriseId: string | null) {
  const scope = (col: any) =>
    enterpriseId ? or(isNull(col), eq(col, enterpriseId)) : isNull(col);

  const [elig, dept, person, personElem, pos, job, payroll, ff, iacPpg, iacSeg] = await Promise.all([
    db.select().from(T.eligibilityCosting).where(scope(T.eligibilityCosting.enterpriseId)),
    db.select().from(T.departmentCosting).where(scope(T.departmentCosting.enterpriseId)),
    db.select().from(T.personCosting).where(scope(T.personCosting.enterpriseId)),
    db.select().from(T.personElementCosting).where(scope(T.personElementCosting.enterpriseId)),
    db.select().from(T.positionCosting).where(scope(T.positionCosting.enterpriseId)),
    db.select().from(T.jobCosting).where(scope(T.jobCosting.enterpriseId)),
    db.select().from(T.payrollCosting).where(scope(T.payrollCosting.enterpriseId)),
    db.select().from(T.fastFormulaOverride).where(scope(T.fastFormulaOverride.enterpriseId)),
    db.select().from(T.iacPpgOverride).where(scope(T.iacPpgOverride.enterpriseId)),
    db.select().from(T.iacSegOverride).where(scope(T.iacSegOverride.enterpriseId)),
  ]);

  const toSegs = (r: any) => ({
    ...r,
    seg1:r.seg1??null, seg2:r.seg2??null, seg3:r.seg3??null,
    seg4:r.seg4??null, seg5:r.seg5??null, seg6:r.seg6??null,
    seg7:r.seg7??null, seg8:r.seg8??null, seg9:r.seg9??null,
  });

  return {
    eligibility:   elig.map(toSegs),
    department:    dept.map(toSegs),
    person:        person.map(r => ({
      ...toSegs(r), legalEntity: r.legalEntity, peopleGroup: r.peopleGroup,
      personAgency: r.personAgency, personType: r.personType, department: r.department,
    })),
    personElement: personElem.map(r => ({
      ...toSegs(r), legalEntity: r.legalEntity, peopleGroup: r.peopleGroup,
      personAgency: r.personAgency, personType: r.personType,
      element: r.element, department: r.department,
    })),
    position:      pos.map(toSegs),
    job:           job.map(toSegs),
    payroll:       payroll.map(toSegs),
    fastFormula:   ff.map(r => ({
      ...toSegs(r), key: r.key, element: r.element, priorityRank: r.priorityRank,
      legalEntity: r.legalEntity, peopleGroup1: r.peopleGroup1, peopleGroup2: r.peopleGroup2,
      personAgency: r.personAgency, personType: r.personType,
      contractClause: r.contractClause, startDate: r.startDate, endDate: r.endDate,
    })),
    iacPpg: iacPpg.map(r => ({
      ...toSegs(r), legalEntity: r.legalEntity, peopleGroupSegment: r.peopleGroupSegment,
      element: r.element, accountType: r.accountType,
      isActive: r.isActive === true || String(r.isActive).toUpperCase() === "Y",
      startDate: r.startDate, endDate: r.endDate,
    })),
    iacSeg: iacSeg.map(r => ({
      id: r.id, legalEntity: r.legalEntity, accountType: r.accountType,
      segment: r.segment, oldValue: r.oldValue, newValue: r.newValue,
      startDate: r.startDate, endDate: r.endDate,
    })),
  };
}

async function loadCombos(enterpriseId: string | null) {
  const scope = (col: any) =>
    enterpriseId ? or(isNull(col), eq(col, enterpriseId)) : isNull(col);
  return db.select().from(T.validCombinations).where(scope(T.validCombinations.enterpriseId));
}

async function loadLov(enterpriseId: string | null) {
  const scope = (col: any) =>
    enterpriseId ? or(isNull(col), eq(col, enterpriseId)) : isNull(col);
  return db.select().from(T.listOfValues)
    .where(scope(T.listOfValues.enterpriseId))
    .orderBy(T.listOfValues.sortOrder);
}

// ---------------------------------------------------------------------------
// POST /v1/costing/simulate
// 9-rank costing resolution for a single assignment/element combination.
// ---------------------------------------------------------------------------
costingRouter.post("/simulate",
  requirePermission("viewSimulate"),
  asyncHandler(async (req, res) => {
    const parsed = simulationInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ success: false, error: parsed.error.flatten() });
      return;
    }
    const eid  = req.serviceToken.enterpriseId;
    const data = await loadDataSources(eid);
    const result = runSimulation(parsed.data, data as any);
    res.json({ success: true, data: result });
  })
);

// ---------------------------------------------------------------------------
// GET /v1/costing/dropdowns
// All dropdown values for the Simulator UI: LOV categories + distinct
// values from each source table. Tiny response, no resolution logic.
// ---------------------------------------------------------------------------
costingRouter.get("/dropdowns",
  requirePermission("viewSimulate"),
  asyncHandler(async (req, res) => {
    const eid  = req.serviceToken.enterpriseId;
    const [data, lovRows] = await Promise.all([
      loadDataSources(eid),
      loadLov(eid),
    ]);
    const dropdowns = computeDropdowns(lovRows as any, data as any);
    res.json({ success: true, data: dropdowns });
  })
);

// ---------------------------------------------------------------------------
// GET /v1/costing/eligibility?elem=&acctType=&date=
// acctType: "Cost Account" | "Offset Account" | "both" (default = both)
// Returns an accountType field on every row so the client can display or
// filter without a second request.
// ---------------------------------------------------------------------------
costingRouter.get("/eligibility",
  requirePermission("viewSimulate"),
  asyncHandler(async (req, res) => {
    const { elem, acctType = "both", date: dateStr } = req.query as Record<string, string>;
    if (!elem) { res.status(422).json({ success: false, error: "elem is required" }); return; }

    const eid  = req.serviceToken.enterpriseId;
    const date = dateStr ? new Date(dateStr + "T00:00:00") : new Date();

    const [dataSrc, combos] = await Promise.all([
      loadDataSources(eid),
      loadCombos(eid),
    ]);
    const elig = dataSrc.eligibility;

    if (acctType === "both") {
      const cost   = computeEligibilityGrid(combos as any, elig as any, elem, "Cost Account",   date)
                       .map(r => ({ ...r, accountType: "Cost Account" }));
      const offset = computeEligibilityGrid(combos as any, elig as any, elem, "Offset Account", date)
                       .map(r => ({ ...r, accountType: "Offset Account" }));
      res.json({ success: true, data: [...cost, ...offset] });
    } else {
      const rows = computeEligibilityGrid(combos as any, elig as any, elem, acctType, date)
                     .map(r => ({ ...r, accountType: acctType }));
      res.json({ success: true, data: rows });
    }
  })
);

// ---------------------------------------------------------------------------
// GET /v1/costing/combinations?elem=&atype=&agency=&cc=&leFilter=&pg1Filter=&pg2Filter=&costType=&eligOnly=
// Full combination resolution through the costing hierarchy.
// atype: "SCA agency" | "Partner Agency" | "Regular"
// costType: "Cost" | "Offset" | "Both"   (default: "Both")
// eligOnly: "true" to suppress ineligible rows
// ---------------------------------------------------------------------------
costingRouter.get("/combinations",
  requirePermission("viewSimulate"),
  asyncHandler(async (req, res) => {
    const {
      elem, atype = "Regular", agency = "", cc = "",
      leFilter = "", pg1Filter = "", pg2Filter = "",
      costType = "Both", eligOnly = "false",
      date: dateStr,
    } = req.query as Record<string, string>;

    if (!elem) { res.status(422).json({ success: false, error: "elem is required" }); return; }

    const eid  = req.serviceToken.enterpriseId;
    const date = dateStr ? new Date(dateStr + "T00:00:00") : new Date();

    const [data, combos] = await Promise.all([
      loadDataSources(eid),
      loadCombos(eid),
    ]);

    let rows = computeCombinationsGrid(combos as any, data as any, {
      elem,
      atype: atype as "SCA agency"|"Partner Agency"|"Regular",
      agency:    agency    || null,
      cc:        cc        || null,
      leFilter:  leFilter  || null,
      pg1Filter: pg1Filter || null,
      pg2Filter: pg2Filter || null,
      costType: costType as "Cost"|"Offset"|"Both",
      date,
    });

    if (eligOnly === "true") rows = rows.filter(r => r.eligible);

    res.json({ success: true, data: rows });
  })
);

// ---------------------------------------------------------------------------
// GET /v1/costing/interagency?elem=&ia=&atype=&agency=&cc=&pg1Filter=&pg2Filter=&costType=&eligOnly=
// Combination resolution for an interagency legal employer with
// LE PPG EL override (rank 1) and LE segment override (rank 2) applied.
// ---------------------------------------------------------------------------
costingRouter.get("/interagency",
  requirePermission("viewInteragency"),
  asyncHandler(async (req, res) => {
    const {
      elem, ia, atype = "Regular", agency = "", cc = "",
      pg1Filter = "", pg2Filter = "",
      costType = "Both", eligOnly = "true",
      date: dateStr,
    } = req.query as Record<string, string>;

    if (!elem || !ia) { res.status(422).json({ success: false, error: "elem and ia are required" }); return; }

    const eid  = req.serviceToken.enterpriseId;
    const date = dateStr ? new Date(dateStr + "T00:00:00") : new Date();

    const [data, combos] = await Promise.all([
      loadDataSources(eid),
      loadCombos(eid),
    ]);

    let rows = computeInteragencyGrid(combos as any, data as any, {
      elem, ia,
      atype: atype as "SCA agency"|"Partner Agency"|"Regular",
      agency:    agency    || null,
      cc:        cc        || null,
      pg1Filter: pg1Filter || null,
      pg2Filter: pg2Filter || null,
      costType: costType as "Cost"|"Offset"|"Both",
      date,
    });

    if (eligOnly === "true") rows = rows.filter(r => r.eligible);

    res.json({ success: true, data: rows });
  })
);

// ---------------------------------------------------------------------------
// GET /v1/costing/data/:table  (raw table access for Synced Data page)
// ---------------------------------------------------------------------------
const TABLE_MAP: Record<string, any> = {
  eligibility:        T.eligibilityCosting,
  department:         T.departmentCosting,
  person:             T.personCosting,
  person_element:     T.personElementCosting,
  position:           T.positionCosting,
  job:                T.jobCosting,
  payroll:            T.payrollCosting,
  fast_formula:       T.fastFormulaOverride,
  iac_ppg:            T.iacPpgOverride,
  iac_seg:            T.iacSegOverride,
  valid_combinations: T.validCombinations,
  list_of_values:     T.listOfValues,
};

costingRouter.get("/data/:table",
  requirePermission("viewSimulate"),
  asyncHandler(async (req, res) => {
    const table = TABLE_MAP[req.params.table!];
    if (!table) { res.status(404).json({ success: false, error: "Unknown table" }); return; }
    const eid  = req.serviceToken.enterpriseId;
    const entCol = table.enterpriseId;
    const where  = eid ? or(isNull(entCol), eq(entCol, eid)) : isNull(entCol);
    const rows   = await db.select().from(table).where(where);
    res.json({ success: true, data: rows });
  })
);
