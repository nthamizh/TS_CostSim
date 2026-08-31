import { Router, type IRouter } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireServiceToken, requirePermission } from "../../middleware/auth.js";
import { simulationInputSchema } from "@costsim/validation";
import { db } from "../../db/client.js";
import { runSimulation } from "./engine.js";
import * as T from "../../db/schema.js";
import { eq, or, isNull } from "drizzle-orm";

export const costingRouter: IRouter = Router();
costingRouter.use(requireServiceToken);

// Helper: fetch all source data for an enterprise
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

  // Normalise DB rows to engine-expected shapes
  const toSegs = (r: any) => ({ ...r,
    seg1:r.seg1??null, seg2:r.seg2??null, seg3:r.seg3??null, seg4:r.seg4??null, seg5:r.seg5??null,
    seg6:r.seg6??null, seg7:r.seg7??null, seg8:r.seg8??null, seg9:r.seg9??null,
  });

  return {
    eligibility:  elig.map(toSegs),
    department:   dept.map(toSegs),
    person:       person.map(r => ({ ...toSegs(r), legalEntity: r.legalEntity, peopleGroup: r.peopleGroup, personAgency: r.personAgency, personType: r.personType })),
    personElement:personElem.map(r => ({ ...toSegs(r), legalEntity: r.legalEntity, peopleGroup: r.peopleGroup, personAgency: r.personAgency, personType: r.personType, element: r.element })),
    position:     pos.map(toSegs),
    job:          job.map(toSegs),
    payroll:      payroll.map(toSegs),
    fastFormula:  ff.map(r => ({ ...toSegs(r), key: r.key, element: r.element, priorityRank: r.priorityRank, legalEntity: r.legalEntity, peopleGroup1: r.peopleGroup1, peopleGroup2: r.peopleGroup2, personAgency: r.personAgency, personType: r.personType, contractClause: r.contractClause, startDate: r.startDate, endDate: r.endDate })),
    iacPpg:       iacPpg.map(r => ({ ...toSegs(r), legalEntity: r.legalEntity, peopleGroupSegment: r.peopleGroupSegment, element: r.element, accountType: r.accountType, isActive: r.isActive, startDate: r.startDate, endDate: r.endDate })),
    iacSeg:       iacSeg.map(r => ({ legalEntity: r.legalEntity, accountType: r.accountType, segment: r.segment, oldValue: r.oldValue, newValue: r.newValue, startDate: r.startDate, endDate: r.endDate })),
  };
}

/**
 * POST /v1/costing/simulate
 * Runs the 9-rank resolution engine. Stateless — no result stored.
 */
costingRouter.post("/simulate",
  requirePermission("viewSimulate"),
  asyncHandler(async (req, res) => {
    const parsed = simulationInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ success: false, error: parsed.error.flatten() });
      return;
    }
    const enterpriseId = req.serviceToken.enterpriseId;
    const data = await loadDataSources(enterpriseId);
    const result = runSimulation(parsed.data, data as any);
    res.json({ success: true, data: result });
  })
);

/**
 * GET /v1/costing/data/:table
 * Returns all rows for a given source table scoped to the enterprise.
 */
const TABLE_MAP: Record<string, any> = {
  eligibility:   T.eligibilityCosting,
  department:    T.departmentCosting,
  person:        T.personCosting,
  person_element:T.personElementCosting,
  position:      T.positionCosting,
  job:           T.jobCosting,
  payroll:       T.payrollCosting,
  fast_formula:  T.fastFormulaOverride,
  iac_ppg:       T.iacPpgOverride,
  iac_seg:       T.iacSegOverride,
  valid_combinations: T.validCombinations,
  list_of_values:T.listOfValues,
};

costingRouter.get("/data/:table",
  requirePermission("viewSimulate"),
  asyncHandler(async (req, res) => {
    const table = TABLE_MAP[req.params.table!];
    if (!table) { res.status(404).json({ success: false, error: "Unknown table" }); return; }
    const eid = req.serviceToken.enterpriseId;
    const entCol = table.enterpriseId;
    const where = eid ? or(isNull(entCol), eq(entCol, eid)) : isNull(entCol);
    const rows = await db.select().from(table).where(where);
    res.json({ success: true, data: rows });
  })
);
