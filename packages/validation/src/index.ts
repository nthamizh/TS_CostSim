import { z } from "zod";

export const simulationInputSchema = z.object({
  elementName:        z.string().min(1),
  assignmentNumber:   z.string().nullable().default(null),
  legalEntity:        z.string().min(1),
  department:         z.string().min(1),
  agency:             z.string().min(1),
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
  jobId:      z.string().uuid(),
  jobType:    z.literal("etl"),
  jobConfig:  z.object({
    targetTable: z.enum([
      "eligibility","department","person","person_element",
      "position","job","payroll","fast_formula",
      "iac_ppg","iac_seg","valid_combinations","list_of_values",
    ]),
    // enterpriseId is optional — if omitted, the ETL extracts it from
    // the Platform service token (which always carries the caller's
    // enterprise context). Providing it explicitly is still supported
    // for platform-admin jobs that need to target a specific enterprise.
    enterpriseId: z.string().uuid().optional(),
    // sourceFileId is the Platform file storage ID of the source CSV.
    // The ETL fetches it from Platform's authenticated file API rather
    // than reading from CostSim's own MinIO, which means data admins
    // upload through My Files in the Platform UI — no separate MinIO
    // access needed.
    sourceFileId: z.string().uuid(),
  }),
  triggeredBy: z.enum(["scheduled","manual"]),
  runId:       z.string().uuid(),
});
