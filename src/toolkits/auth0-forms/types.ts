export type FormsToolOutput = {
  formId: string;
  contextJwt: string;
  prefill: Record<string, string>;
  trustedFields: Record<string, string>;
  successMessage: string;
};
