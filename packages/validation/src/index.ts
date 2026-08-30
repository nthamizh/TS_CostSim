import { z } from "zod";

export const simulationInputSchema = z.object({
  elementName:        z.string().min(1),
  assignmentNumber:   z.string().optional().nullable(),
  legalEntity:        z.string().min(1),
  department:         z.string().min(1),
  agency:             z.string().min(1),
  peopleGroup1:       z.string().min(1),
  peopleGroup2:       z.string().min(1),
  peopleGroup3:       z.string().optional().nullable(),
  contractClause:     z.string().optional().nullable(),
  payrollDefinition:  z.string().optional().nullable(),
  jobCode:            z.string().optional().nullable(),
  positionCode:       z.string().optional().nullable(),
  effectiveDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const etlWebhookSchema = z.object({
  jobId:      z.string().uuid(),
  jobType:    z.literal("etl"),
  jobConfig:  z.object({
    targetTable: z.enum([
      "eligibility","department","person","person_element",
      "position","job","payroll","fast_formula",
      "iac_ppg","iac_seg","valid_combinations","list_of_values",
    ]),
    enterpriseId: z.string().uuid(),
  }),
  triggeredBy: z.enum(["scheduled","manual"]),
  runId:       z.string().uuid(),
});
