import { z } from "zod";

export const simulationInputSchema = z.object({
  elementName:        z.string().min(1),
  assignmentNumber:   z.string().nullable().default(null),
  legalEntity:        z.string().min(1),
  department:         z.string().default(""),
  agency:             z.string().default(""),
  peopleGroup1:       z.string().min(1),
  peopleGroup2:       z.string().min(1),
  peopleGroup3:       z.string().nullable().default(null),
  contractClause:     z.string().nullable().default(null),
  payrollDefinition:  z.string().nullable().default(null),
  jobCode:            z.string().nullable().default(null),
  positionCode:       z.string().nullable().default(null),
  effectiveDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const etlWebhookSchema = z.object({
  // Platform scheduler sends exactly: { runId, jobType, jobConfig }
  // jobId and triggeredBy were in the original schema but are never
  // sent by Platform's scheduler service — removed to match reality.
  runId:    z.string().uuid(),
  jobType:  z.literal("etl"),
  jobConfig: z.object({
    targetTable: z.enum([
      "eligibility","department","person","person_element",
      "position","job","payroll","fast_formula",
      "iac_ppg","iac_seg","valid_combinations","list_of_values",
    ]),
    // enterpriseId optional — resolved from token if absent
    enterpriseId: z.string().uuid().optional(),
    // sourceFileId: Platform file storage ID of the source CSV
    sourceFileId: z.string().uuid(),
  }),
});
