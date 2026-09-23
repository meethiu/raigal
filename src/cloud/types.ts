import type { z } from "zod/v4";
import type {
	AllowedOwner,
	DeviceCodeResponse,
	DeviceTokenResponse,
	EntitlementClaims,
	EntitlementResponse,
	Finding,
	Policy,
	RepoRef,
	Report,
	Run,
	Step,
	AgentTelemetry,
} from "./contract.js";

export type FindingType = z.infer<typeof Finding>;
export type RepoRefType = z.infer<typeof RepoRef>;
export type StepType = z.infer<typeof Step>;
export type ReportType = z.infer<typeof Report>;
export type RunType = z.infer<typeof Run>;
export type AgentTelemetryType = z.infer<typeof AgentTelemetry>;
export type PolicyType = z.infer<typeof Policy>;
export type AllowedOwnerType = z.infer<typeof AllowedOwner>;
export type EntitlementClaimsType = z.infer<typeof EntitlementClaims>;
export type EntitlementResponseType = z.infer<typeof EntitlementResponse>;
export type DeviceCodeResponseType = z.infer<typeof DeviceCodeResponse>;
export type DeviceTokenResponseType = z.infer<typeof DeviceTokenResponse>;
