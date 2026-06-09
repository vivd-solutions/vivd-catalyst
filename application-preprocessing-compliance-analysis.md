# AI Application Preprocessing Compliance Analysis

Prepared for: customer discussion  
Project: AI-assisted preprocessing of purchase applications for flats  
Date: 2026-06-04

Note: This document is a technical and compliance-oriented analysis, not legal advice. The final workflow, lawful basis, privacy notice, and processor agreements should be reviewed by the customer's legal counsel or Datenschutzbeauftragter before production use.

## 1. Executive Summary

The planned system can be built in a legally defensible way, but it must be treated as a sensitive personal-data workflow, not as a normal chatbot.

Applicants who want to buy a flat may submit an application email and supporting documents such as payslips. The AI system would read the material, extract relevant facts, compare statements from the application with the documents, flag inconsistencies, and prepare a summary or draft response for a human reviewer. For example, if an applicant writes that they earn 3,500 EUR per month but the payslip shows 2,500 EUR, the system may flag this for review.

The most important legal design point is that the AI must not make the final decision. A human should review the AI output, decide what it means, and manually approve any response or next step. This does not remove all GDPR/DSGVO duties, but it avoids the highest-risk version of the project: a solely automated decision about a person's access to housing or financial opportunity.

The recommended provider choice is:

1. **Azure OpenAI / Microsoft Foundry in an EU Data Zone or EU regional deployment** if the customer wants the strongest enterprise, German-market, and Microsoft procurement story.
2. **OpenAI Platform directly with Europe data residency and Zero Data Retention / modified abuse-monitoring controls** if access to the newest GPT models is the priority.
3. **AWS Bedrock in EU In-Region or EU Geo mode** if the customer is already AWS-based and can accept non-GPT models such as Anthropic Claude, Amazon Nova, Mistral, or Meta Llama in EU regions.
4. **Google Vertex AI / Gemini in an EU region** if the customer is Google Cloud-based and accepts Gemini models instead of GPT.
5. **OpenRouter only for prototypes with fake data, or for production only with enterprise DPA, EU in-region routing, Zero Data Retention, provider allowlisting, and legal approval.** It adds an extra routing party and is therefore harder to explain for real payslips.

EU servers are not automatically required by GDPR in every case. GDPR permits international transfers if the correct legal safeguards are in place. However, for payslips and purchase applications in Germany, EU storage and EU inference are strongly recommended because they reduce legal complexity, vendor-risk concerns, and customer objections.

## 2. Plain-Language Explanation

### What data is involved?

The application will likely process:

- Applicant name, address, email address, phone number.
- Application email text and any statements made by the applicant.
- Payslips, salary information, employer details, tax and social insurance information.
- Bank details if present in documents.
- Financing information, proof of funds, or mortgage/pre-approval documents.
- Internal notes, recommendation text, and status decisions.

This is **personal data** because it relates to identifiable people. It is also high-risk personal data in practice because payslips can include salary, tax, employer, insurance, religious church-tax indicators, union deductions, health-insurance references, and other private information.

### What is GDPR / DSGVO?

**GDPR** means **General Data Protection Regulation**. It is the EU privacy law.  
**DSGVO** means **Datenschutz-Grundverordnung**, the German name for the same law.

If the customer processes personal data of applicants in Germany or the EU, GDPR applies. This is not optional. To be legal, the customer needs a lawful basis, transparency, security measures, deletion rules, and proper contracts with service providers.

### What is a controller?

The **controller** is the party that decides why and how personal data is processed. In this project, the controller is likely the real-estate customer, broker, seller-side organization, or entity operating the application workflow.

### What is a processor?

The **processor** is a provider that processes personal data for the controller and only according to the controller's instructions. An AI/cloud provider is usually a processor for this workflow.

### What is a DPA / AVV?

**DPA** means **Data Processing Addendum** or **Data Processing Agreement**.  
**AVV** means **Auftragsverarbeitungsvertrag**, the German term for a processor agreement.

Under GDPR Article 28, if a controller uses a processor, there must be a binding data-processing contract. This contract sets rules such as:

- The provider may process data only for the agreed purpose.
- Provider staff must be bound to confidentiality.
- Security measures must be in place.
- Subprocessors must be controlled.
- Data must be returned or deleted when no longer needed.
- The controller must have audit and compliance rights.

In simple words: if we send applicant documents to an AI provider, we need the provider's DPA/AVV before production use.

### What is Zero Data Retention?

**Zero Data Retention**, often shortened to **ZDR**, means the AI provider does not retain customer content such as prompts, files, or model responses for normal logging after processing. Exact behavior differs by provider and endpoint.

For payslips, ZDR or the closest available reduced-retention setting is important. The system should not leave full applicant documents sitting in provider logs.

### What is "no training on customer data"?

This means the provider does not use our applicant data to train or improve its general models. This is a must-have for this use case.

### What is EU data residency?

**Data residency** means choosing where data is stored and sometimes where it is processed. For AI systems, two things matter:

- **Storage at rest:** where files, prompts, outputs, logs, and application state are stored.
- **Inference processing:** where the model actually processes the prompt and document content.

For this project, the preferred setup is both EU storage and EU inference processing.

## 3. Is the Planned Workflow Legal in Principle?

Yes, it can be legal in principle, but only if the workflow is designed correctly.

The legally safer version is:

1. Applicant submits application material for a specific flat purchase.
2. System ingests the email and documents.
3. AI extracts relevant facts and checks consistency.
4. AI prepares a neutral summary, a discrepancy list, and a draft response.
5. Human reviewer checks the output.
6. Human makes the decision and sends any response manually.
7. Raw documents are deleted when no longer needed.
8. Only the minimum necessary audit record is retained.

The legally risky version is:

1. AI receives every document from every possible lead without clear necessity.
2. AI scores applicants automatically.
3. AI rejects or approves applicants automatically.
4. Full payslips are kept long term.
5. Provider logs retain applicant data.
6. The applicant was not told how their data is processed.

The planned human-review approach is important. GDPR Article 22 restricts decisions based solely on automated processing if they have legal or similarly significant effects. Housing and financing-related decisions can be significant for the person. A real human review step reduces this risk.

## 4. Important Legal Requirements for This Project

### Lawful basis

The customer needs a lawful reason to process the data. For a flat purchase application, possible legal bases may include:

- **Pre-contractual necessity:** processing needed to take steps before entering a purchase-related agreement.
- **Legitimate interest:** verifying serious purchase interest, ability to proceed, and preventing false statements.
- **Legal obligation:** only where a specific law requires the processing.
- **Consent:** possible in some cases, but often not the best basis if the applicant has no realistic choice.

The exact lawful basis should be confirmed by the customer's data-protection lawyer or Datenschutzbeauftragter.

### Data minimization

GDPR requires collecting only what is needed. This does not always mean redacting everything before AI processing, but it does mean the system should not collect, send, store, or retain more than necessary.

For example:

- It may be justifiable to process a full payslip temporarily to verify income.
- It is harder to justify keeping the full unredacted payslip for months if only the verified net-income result is needed.
- The system should not use church tax, union membership, health-insurance details, or unrelated payroll deductions for scoring.

### Transparency

Applicants must receive a privacy notice explaining:

- Who is responsible for the processing.
- What data is processed.
- Why the data is processed.
- Which providers are used.
- Whether AI is used for preprocessing.
- That the final decision is human.
- How long documents are retained.
- How applicants can exercise their GDPR rights.

### Security

The system must use appropriate technical and organisational measures. For this use case, that means:

- EU-hosted storage where possible.
- Encryption in transit and at rest.
- Strict role-based access control.
- Multi-factor authentication for staff.
- Audit logs.
- Separate environments for development and production.
- No real applicant data in test systems.
- No consumer AI accounts.
- No browser plugins or unofficial AI wrappers.
- Short retention and deletion rules.
- No unnecessary model tools such as web browsing.

### Processor contracts

Every provider that receives applicant personal data must be covered by a DPA/AVV. This includes:

- AI model provider.
- Cloud hosting provider.
- OCR/document-processing provider.
- Email-processing provider.
- File storage provider.
- Vector database provider, if used.
- Monitoring/logging providers, if logs contain personal data.

### International transfers

EU servers are not absolutely required by GDPR. Data can leave the EU/EEA if valid transfer mechanisms exist, such as an adequacy decision, the EU-US Data Privacy Framework where applicable, Standard Contractual Clauses, and transfer-risk assessment where needed.

However, for this project, EU processing is the better practical requirement. It reduces the legal review burden and is easier to explain to a German customer.

### Automated decisioning

The AI should not decide:

- Whether the applicant is accepted.
- Whether the applicant is rejected.
- Whether the applicant is trustworthy.
- Whether the applicant may buy the flat.

The AI may prepare:

- Extracted income fields.
- A comparison between application statements and documents.
- Missing-document lists.
- Neutral summaries.
- Draft emails.
- "Needs human review" flags.

The human must remain able to ignore, correct, or override the AI output.

### EU AI Act

The EU AI Act can become relevant if the system is used to evaluate creditworthiness or financial eligibility. The AI Act classifies AI systems used to evaluate the credit score or creditworthiness of natural persons as high-risk in certain contexts.

For this project, avoid designing the tool as a credit-scoring system. It should be a document-preprocessing and human-review assistant. If the customer wants the system to calculate affordability scores or rank buyers by financial reliability, legal review becomes more important.

## 5. Recommended Process Design

### Intake

Applications should be received through a controlled channel, not scattered across private inboxes. The system should capture the application email, documents, timestamps, and source.

### Storage

Raw files should be stored in an EU cloud region where possible. They should be encrypted. Access should be limited to people who need it.

### Extraction

OCR and document extraction should identify:

- Applicant name.
- Employer name.
- Payslip period.
- Net monthly income.
- Gross income if needed.
- Document date.
- Whether the document appears complete.
- Whether the name matches the applicant.
- Whether stated income and payslip income differ.

The system should ignore or mask fields that are not needed for the purchase-preprocessing purpose.

### AI analysis

The AI should receive only the information needed for the task. If the full payslip must be sent to the model, that should happen only through a provider and endpoint covered by DPA/AVV, EU processing where possible, and ZDR or reduced-retention settings.

The AI should output structured, reviewable results, for example:

- "Applicant stated monthly net income: 3,500 EUR."
- "Payslip extracted monthly net income: 2,500 EUR."
- "Difference: 1,000 EUR."
- "Flag: discrepancy, requires human review."
- "No final decision made."

### Human review

A human reviewer should see:

- The AI summary.
- The extracted fields.
- The source document link.
- The discrepancy reason.
- A clear warning that the AI result is only assistance.

The reviewer should confirm or correct the result before any message is sent.

### Retention

The customer should define a deletion policy before launch.

Recommended default:

- Raw payslips: delete quickly after verification unless legally needed.
- Rejected or inactive applications: delete after a defined short period unless there is a documented reason to retain.
- Final transaction records: retain only what is necessary for contract, accounting, legal claim, or compliance purposes.
- Logs: avoid personal data; if unavoidable, use short retention.

### Audit trail

Keep a minimal audit trail:

- Which application was processed.
- Which human reviewed it.
- Whether the income was verified.
- Whether a discrepancy was found.
- When the raw document was deleted.

Do not keep unnecessary AI prompts or full model outputs if they contain document text.

## 6. Provider Evaluation

### Summary Table

| Provider | Production suitability for this use case | DPA / AVV | EU processing option | Training on customer data | Main certifications/signals | Main concern |
|---|---:|---:|---:|---:|---|---|
| Azure OpenAI / Microsoft Foundry | Very strong | Yes, via Microsoft Product Terms / DPA | Yes, EU Data Zone and EU regional deployments | Microsoft says customer data is not used to train foundation models without permission | Azure ISO, SOC, C5, broad Microsoft compliance; Microsoft Foundry in ISO 42001 scope | Exact model availability depends on deployment type and region |
| OpenAI Platform | Strong if configured correctly | Yes, OpenAI DPA | Yes, Europe region for supported endpoints/models | OpenAI says API data is not used for training unless customer opts in | SOC 2 Type II, ISO 27001/27701, ISO 42001, CSA STAR Level 1 | EU residency requires approval for abuse-monitoring controls and ZDR amendment |
| AWS Bedrock | Strong if GPT is not required | Yes, AWS GDPR DPA | Yes, In-Region and EU Geo inference | AWS says Bedrock data is not shared with model providers or used to improve base models | ISO, SOC, CSA STAR, GDPR-supporting, HIPAA eligible, FedRAMP High in GovCloud | GPT/OpenAI model availability in Bedrock is not the obvious EU route; EU model choice is mostly non-GPT |
| Google Vertex AI / Gemini | Strong if Gemini is acceptable | Yes, Google Cloud Data Processing Addendum | Yes, many EU regions | Google says Vertex AI customer data is not used to train/fine-tune models without permission/instruction | ISO 27001, SOC 2 Type II, ISO 27701, BSI C5 for Google Cloud | Not GPT; some features such as grounding/search have special retention behavior |
| OpenRouter | Not recommended as default for real payslips | Signed DPA only for enterprise tier | EU in-region routing only enterprise by request | ZDR and data-collection controls exist | Trust portal / enterprise docs, ZDR routing controls | Adds an extra routing layer and many upstream providers; self-serve DPA is not enough for production sensitive data |

## 7. Provider Details

### 7.1 Azure OpenAI / Microsoft Foundry

**Practical assessment:** best default for a German business customer if they want GPT models, EU deployment options, enterprise controls, and a conservative procurement story.

Microsoft states for Azure/OpenAI/Foundry model services that prompts, completions, embeddings, and training data are not available to OpenAI or other customers and are not used to train foundation models without permission. Microsoft also documents abuse-monitoring and logging controls.

For data residency, Microsoft Foundry deployment types include:

- **Global:** may process inference data in any Azure region.
- **Data Zone:** processes prompts and responses only within the Microsoft-specified data zone, such as EU.
- **Standard / Regional:** processes in the selected deployment region.

For this project, avoid Global deployments. Use:

- **EU Data Zone** if EU processing is sufficient.
- **Single EU regional deployment** if the customer wants a stricter region choice.

Microsoft's deployment documentation states that the EU Data Zone processes data within regions located in countries covered by the Azure EU Data Boundary. As of the Microsoft page checked, this includes regions in France, Germany, Italy, Netherlands, Norway, Poland, Spain, Sweden, and Switzerland.

**Models in EU:** Microsoft's current Azure OpenAI model page lists current GPT models and region/deployment availability. Current EU Data Zone / EU regional entries include GPT-5-family models such as `gpt-5.4`, `gpt-5.2`, `gpt-5.1`, `gpt-5`, `gpt-5-mini`, plus `o3`, `o4-mini`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`, `gpt-4o`, and `gpt-4o-mini`, depending on region and deployment type. The exact model and snapshot should be checked during deployment, because availability changes.

**DPA / AVV:** Yes. Microsoft cloud services are covered through Microsoft's Product Terms and Data Protection Addendum.

**Important certifications and compliance signals:**

- ISO/IEC 27001 for Azure.
- SOC 2 Type II for Microsoft cloud services.
- BSI C5 for German cloud-security assurance.
- ISO/IEC 42001 for Microsoft AI services, with Microsoft Foundry listed in scope.

**Recommendation:** strongest default choice.

### 7.2 OpenAI Platform Directly

**Practical assessment:** strong choice if newest GPT model access matters more than Microsoft/Azure procurement.

OpenAI says API data is not used to train or improve OpenAI models unless the customer explicitly opts in. OpenAI offers a DPA. For EEA or Swiss customers, OpenAI's current DPA states that the agreement is with OpenAI Ireland Ltd.

OpenAI's data controls documentation states that eligible customers can configure data residency. For Europe, the OpenAI API currently supports:

- Regional storage.
- Regional processing.
- Europe region covering EEA plus Switzerland.
- Required domain prefix: `eu.api.openai.com`.

However, non-US data residency requires approval for abuse-monitoring controls and execution of a Zero Data Retention amendment.

**Models in EU:** OpenAI's current data-residency table lists Europe support for major text endpoints. For `/v1/chat/completions` and `/v1/responses`, the listed model snapshots include GPT-5.5, GPT-5.4, GPT-5.2, GPT-5.1, GPT-5, GPT-5 mini/nano, GPT-4.1 variants, `o3`, `o4-mini`, `gpt-4o`, `gpt-4o-mini`, and older models. Embeddings such as `text-embedding-3-small` and `text-embedding-3-large` are also listed as supported across regions.

**DPA / AVV:** Yes. OpenAI has a DPA for API/business services.

**Important certifications and compliance signals:**

- SOC 2 Type II for API and business product services.
- ISO/IEC 27001 and ISO/IEC 27701 for the systems supporting API, ChatGPT Enterprise, and ChatGPT Edu.
- ISO/IEC 42001 AI management system.
- CSA STAR Level 1.

**Recommendation:** good production choice if the customer can get the required data-residency and retention controls approved before launch.

### 7.3 AWS Bedrock

**Practical assessment:** strong security/compliance choice if the customer is already AWS-based and GPT is not mandatory.

AWS says Bedrock customer data is encrypted in transit and at rest, can use AWS Key Management Service, IAM, PrivateLink, CloudTrail, and CloudWatch, and is not shared with model providers or used to improve base models.

For residency, AWS Bedrock provides:

- **In-Region inference:** requests stay in the selected AWS region.
- **Geographic / Geo cross-region inference:** requests may move within a geography such as EU, but not outside it.
- **Global inference:** may process in any commercial region and should not be used for this project.

For this project, use In-Region EU or EU Geo. Avoid Global.

**Models in EU:** AWS Bedrock's regional availability page lists models by provider and region. EU-region examples include Anthropic Claude models, Amazon Nova and Titan models, and selected models from providers such as Mistral, Meta, Cohere, and others depending on exact region. The Bedrock page also includes an OpenAI section, but the GPT-5.4/GPT-5.5 entries checked did not show EU regions as the natural route. If GPT plus EU is a hard requirement, Azure OpenAI or OpenAI Platform direct is cleaner.

**DPA / AVV:** Yes. AWS provides an AWS GDPR Data Processing Addendum.

**Important certifications and compliance signals:**

- AWS ISO certifications include ISO/IEC 27001, 27017, 27018, 27701, and more, with Amazon Bedrock in scope except Bedrock Marketplace.
- Bedrock is in scope for common compliance standards including ISO, SOC, and CSA STAR Level 2.
- AWS states customers can use Bedrock in compliance with GDPR.
- HIPAA eligibility and FedRAMP High are strong security signals but usually not decisive for a German real-estate purchase workflow.

**Recommendation:** strong alternative if AWS-native and non-GPT models are acceptable.

### 7.4 Google Vertex AI / Gemini

**Practical assessment:** credible provider if the customer is already on Google Cloud and accepts Gemini models.

Google states that it will not use customer data to train or fine-tune AI/ML models without the customer's prior permission or instruction. Google's Vertex AI documentation also describes zero-data-retention-related controls and exceptions, including abuse monitoring and special behavior for features such as grounding with Google Search.

For residency, Google Cloud has many EU regions, including Belgium, Finland, Frankfurt, London, Madrid, Milan, Netherlands, Paris, Turin, Warsaw, and Zurich. Vertex AI uses regional endpoints, for example `https://europe-west4-aiplatform.googleapis.com`.

**Models in EU:** Google's data-residency documentation lists Gemini model support by region/multi-region. Current examples include Gemini 3.5 Flash, Gemini 3.1 Flash-Lite, Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 2.5 Flash-Lite, Gemini embeddings, and related tuning or live/image variants depending on location. Exact availability should be checked at deployment time.

**DPA / AVV:** Yes. Google Cloud provides a Cloud Data Processing Addendum.

**Important certifications and compliance signals:**

- ISO/IEC 27001 for Google Cloud's information security management system.
- SOC 2 Type II reports for Google Cloud.
- ISO/IEC 27701 privacy management.
- BSI C5:2020 attestation for Google Cloud, including Generative AI on Vertex AI in scope.

**Recommendation:** good legal/compliance option, but not the GPT route.

### 7.5 OpenRouter

**Practical assessment:** not recommended as the default for production payslip processing.

OpenRouter is useful because it can route to many model providers and provides controls such as Zero Data Retention routing, provider logging controls, and data-collection denial. OpenRouter states that it does not store prompts or responses unless the customer opts into logging or product-improvement use.

However, for this project OpenRouter adds an extra processor and routing layer. The customer would need to trust OpenRouter plus every upstream provider selected by routing. This makes the legal explanation and subprocessor review harder.

OpenRouter's help article says a mutually signed DPA is available exclusively to enterprise-tier customers. Self-serve customers can review documentation, but the signed DPA applies to enterprise accounts. OpenRouter also documents EU in-region routing through `eu.openrouter.ai`, but it is available for enterprise customers by request.

OpenRouter's privacy policy states that personal data may be transferred to servers in the US or other countries outside the EEA/UK, with transfer safeguards. That is not automatically illegal, but it is not the cleanest design for German payslip processing.

**DPA / AVV:** Yes only for enterprise production use; self-serve is not enough if a signed DPA is required.

**EU processing:** Enterprise EU in-region routing by request.

**Production conditions if used anyway:**

- Enterprise account.
- Signed DPA.
- EU in-region routing enabled.
- ZDR enforced.
- Data collection denied.
- Provider allowlist limited to acceptable EU providers.
- Prompt/output logging disabled.
- Legal and Datenschutzbeauftragter approval.

**Recommendation:** acceptable for fake-data prototypes; avoid for real payslips unless the customer explicitly wants it and accepts the extra review burden.

## 8. Certification and Compliance Glossary

### GDPR / DSGVO

EU data protection law. It is not a normal security certificate. A provider cannot simply be "GDPR certified" in a way that makes the customer compliant. The customer must implement the process correctly.

### DPA / AVV

The processor contract required when a service provider processes personal data on behalf of the customer. This is legally more important than a marketing security badge.

### SCC

**Standard Contractual Clauses.** EU-approved contract clauses used for certain international data transfers outside the EEA.

### EEA

**European Economic Area.** Includes EU countries plus Iceland, Liechtenstein, and Norway.

### ISO/IEC 27001

Information security management system. This is the baseline security certification customers usually expect.

### ISO/IEC 27017

Cloud-security controls. Useful when evaluating cloud providers.

### ISO/IEC 27018

Protection of personally identifiable information in public cloud services. Relevant for personal-data processing.

### ISO/IEC 27701

Privacy information management. Very relevant for GDPR-style privacy programs.

### ISO/IEC 42001

AI management system. Relevant for AI governance, but it does not replace GDPR, DPA/AVV, or secure implementation.

### SOC 2 Type II

Independent audit report about controls over a period of time, usually covering criteria such as security, availability, confidentiality, processing integrity, and privacy. "Type II" is stronger than "Type I" because it covers operating effectiveness over time.

### BSI C5

German cloud-security criteria catalogue from the German Federal Office for Information Security, **Bundesamt fuer Sicherheit in der Informationstechnik**. This is especially useful for German customers because it is locally recognized.

### CSA STAR

Cloud Security Alliance Security, Trust, Assurance, and Risk registry/program. Useful cloud-security signal, but usually secondary to ISO 27001, SOC 2 Type II, DPA/AVV, and EU residency.

### HIPAA

US healthcare privacy/security regime. Usually not relevant to German real-estate applications unless actual US health data is processed. It is a security signal, not a deciding requirement here.

### FedRAMP

US government cloud authorization. Strong security signal for US public-sector workloads, but not a primary requirement for a German real-estate purchase workflow.

## 9. Legal and Technical Requirements for the Build

### Must-have before production

- Written DPA/AVV with every provider that processes applicant data.
- EU storage and EU inference where possible.
- No consumer ChatGPT, consumer Gemini, browser extensions, or unofficial wrappers.
- No model training on customer data.
- ZDR or reduced-retention controls for AI prompts/files/outputs.
- Clear privacy notice for applicants.
- Human final decision and human sending step.
- Encryption at rest and in transit.
- Role-based access control and MFA.
- Audit logging without storing full document text in logs.
- Deletion policy for raw documents and inactive applications.
- Subprocessor review.
- Documented lawful basis.
- Data-protection impact assessment if the customer's Datenschutzbeauftragter considers the process high risk.

### Should-have

- Customer-managed encryption keys where practical.
- Private networking/private endpoints where practical.
- Separate production and development systems.
- Synthetic/fake data in testing.
- Structured AI output with confidence flags and source references.
- "Needs human review" status for discrepancies.
- Allowlist of accepted document fields.
- No use of protected characteristics.
- Periodic manual quality checks.
- Incident-response process.

### Avoid

- Automatic rejection or acceptance.
- Ranking applicants by opaque AI score.
- Storing unredacted payslips long term.
- Sending applicant data to multiple model providers through automatic fallback.
- Using global routing for sensitive document processing.
- Using AI web browsing or third-party tools on applicant documents.
- Logging prompts and completions with full document text.
- Letting staff paste documents into personal AI accounts.

## 10. Recommended Architecture

1. **Secure intake:** receive email/documents through controlled system.
2. **EU storage:** store raw files in EU region, encrypted.
3. **Document extraction:** OCR and parse documents in the same cloud region where possible.
4. **Data minimization:** extract only needed fields for purchase preprocessing.
5. **LLM processing:** send only necessary context to the AI provider; if full document is necessary, use EU processing and ZDR/reduced retention.
6. **Structured result:** produce a checklist, discrepancy flags, and draft communication.
7. **Human review:** human confirms, edits, or rejects the AI output.
8. **Manual sending:** no automatic external email sending.
9. **Deletion:** delete raw documents when no longer needed.
10. **Audit:** keep only minimal compliance record.

## 11. Recommended Provider Decision

For this specific customer, the recommended starting point is:

**Azure OpenAI / Microsoft Foundry with EU Data Zone or EU regional deployment.**

Reason:

- It supports GPT models through a large enterprise cloud.
- It has strong Microsoft compliance documentation.
- It has EU deployment options.
- It has German-relevant assurance such as BSI C5 through Azure/Microsoft cloud compliance.
- It is easier to explain to a German customer than a multi-provider router.

If the customer needs the newest GPT models immediately and Azure availability lags, use:

**OpenAI Platform directly with Europe data residency, approved retention controls, DPA, and ZDR/MAM.**

If the customer is already AWS-native and GPT is not mandatory, use:

**AWS Bedrock with EU In-Region or EU Geo inference.**

If the customer is Google-native and Gemini is acceptable, use:

**Google Vertex AI / Gemini in EU regions.**

Do not use OpenRouter for real payslips unless the customer is on enterprise terms and the exact routing, DPA, EU region, and ZDR setup has been approved.

## 12. Customer-Facing Short Answer

The project can be GDPR/DSGVO-conform if it is implemented as an AI-assisted preprocessing tool with human final review. The AI may read documents, compare stated and actual income, flag inconsistencies, and draft internal summaries or responses. It should not automatically accept, reject, rank, or send decisions.

The most important provider requirements are DPA/AVV, no training on customer data, EU processing where possible, Zero Data Retention or reduced retention, strong certifications such as ISO 27001 and SOC 2 Type II, and German-relevant assurance such as BSI C5.

The safest production provider choice is Azure OpenAI / Microsoft Foundry in an EU configuration. OpenAI Platform direct is also viable if configured with Europe data residency and ZDR/MAM. AWS Bedrock and Google Vertex AI are strong if non-GPT models are acceptable. OpenRouter should be avoided for production payslips unless enterprise EU routing and DPA are in place.

## 13. Draft Applicant Privacy Notice

This is a practical draft only. It must be adapted to the final workflow, provider contracts, retention periods, and legal basis, then reviewed by the customer's legal counsel or Datenschutzbeauftragter.

### Privacy notice for purchase applications

**Controller:**  
[Customer legal name, address, email, phone]

**Data protection contact:**  
[Data protection officer or privacy contact, if applicable]

**Purpose of processing:**  
We process your application and supporting documents in order to review your interest in purchasing a property, verify information submitted with your application, communicate with you, prepare the next steps in the purchase process, and comply with applicable legal obligations.

**Categories of data processed:**  
We may process your contact details, application email, statements made in your application, uploaded documents, payslips or income evidence, financing or proof-of-funds information, employer information, identity or transaction documents where legally required, internal review notes, and communication history.

**Use of AI-assisted preprocessing:**  
We use an AI-assisted system to help review application documents. The system may extract information from documents, compare information stated in the application with supporting documents, flag missing documents or discrepancies, and prepare summaries or draft responses for human review. The AI system does not make the final decision. A human reviewer checks the result and decides on any response or next step.

**Legal basis:**  
Depending on the specific processing step, the legal basis may be pre-contractual measures, legitimate interests in reviewing and verifying purchase applications, legal obligations such as anti-money-laundering duties, or another lawful basis where applicable. The final lawful basis must be confirmed for the specific process.

**Service providers:**  
We may use technical service providers for secure hosting, document storage, document processing, and AI-assisted analysis. These providers process personal data only under a data-processing agreement and according to our instructions. Where possible, processing is performed in the EU or EEA.

**International transfers:**  
If personal data is transferred outside the EU or EEA, we use legally required safeguards, such as adequacy decisions, Standard Contractual Clauses, or other applicable transfer mechanisms.

**Retention:**  
We keep personal data only as long as necessary for the application review, purchase process, legal obligations, or legal claims. Full sensitive documents such as payslips are deleted when they are no longer needed for verification or review, unless a legal obligation requires longer retention. Minimal verification records may be retained for audit and documentation purposes.

**Your rights:**  
You may have the right to access your data, correct inaccurate data, request deletion, restrict processing, object to processing, request data portability where applicable, and lodge a complaint with a supervisory authority.

**No fully automated decision:**  
We do not use the AI system to make a solely automated final decision about your application. Responses and next steps are reviewed and decided by a human.

## 14. Source List

### Legal sources

- GDPR official text, Regulation (EU) 2016/679: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679
- EDPB SME guide on individual rights and automated decisions: https://www.edpb.europa.eu/sme-data-protection-guide/respect-individuals-rights_en
- EU AI Act, Regulation (EU) 2024/1689: https://eur-lex.europa.eu/eli/reg/2024/1689/oj

### OpenAI

- OpenAI security and privacy accreditations: https://openai.com/security
- OpenAI Data Processing Addendum: https://openai.com/policies/data-processing-addendum/
- OpenAI Platform data controls and data residency: https://platform.openai.com/docs/guides/your-data
- OpenAI models documentation: https://platform.openai.com/docs/models

### Microsoft / Azure

- Microsoft data, privacy, and security for Foundry Models sold by Azure: https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/openai/data-privacy
- Microsoft Foundry deployment types and data processing locations: https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/deployment-types
- Azure OpenAI / Foundry models and model availability: https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models
- Azure compliance documentation: https://learn.microsoft.com/en-us/azure/compliance/
- Microsoft Products and Services Data Protection Addendum: https://www.microsoft.com/licensing/docs/view/Microsoft-Products-and-Services-Data-Protection-Addendum-DPA?lang=1
- Azure ISO/IEC 27001: https://learn.microsoft.com/en-us/azure/compliance/offerings/offering-iso-27001
- Microsoft SOC 2 Type II: https://learn.microsoft.com/en-us/compliance/regulatory/offering-soc-2
- Microsoft BSI C5: https://learn.microsoft.com/en-us/compliance/regulatory/offering-c5-germany
- Microsoft ISO/IEC 42001: https://learn.microsoft.com/en-us/compliance/regulatory/offering-iso-42001

### AWS

- Amazon Bedrock security and privacy: https://aws.amazon.com/bedrock/security-compliance/
- Amazon Bedrock data protection: https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html
- Amazon Bedrock regional availability: https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html
- Amazon Bedrock compliance validation: https://docs.aws.amazon.com/bedrock/latest/userguide/compliance-validation.html
- AWS ISO and CSA STAR certified services: https://aws.amazon.com/compliance/iso-certified/
- AWS GDPR Data Processing Addendum: https://d1.awsstatic.com/legal/aws-gdpr/AWS_GDPR_DPA.pdf

### Google Cloud

- Google Vertex AI zero data retention / data governance: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/vertex-ai-zero-data-retention
- Google Cloud Data Processing Addendum: https://cloud.google.com/terms/data-processing-addendum
- Google Vertex AI locations: https://docs.cloud.google.com/vertex-ai/docs/general/locations
- Google generative AI data residency: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency
- Google Cloud ISO/IEC 27001: https://cloud.google.com/security/compliance/iso-27001
- Google Cloud SOC 2: https://cloud.google.com/security/compliance/soc-2
- Google Cloud ISO/IEC 27701: https://cloud.google.com/security/compliance/iso-27701
- Google Cloud BSI C5: https://cloud.google.com/security/compliance/bsi-c5

### OpenRouter

- OpenRouter Zero Data Retention: https://openrouter.ai/docs/guides/features/zdr
- OpenRouter data collection documentation: https://openrouter.ai/docs/guides/privacy/data-collection/
- OpenRouter DPA availability: https://openrouter.zendesk.com/hc/en-us/articles/47828437697051-How-do-I-get-OpenRouter-s-Data-Processing-Agreement-DPA-for-GDPR-compliance
- OpenRouter sovereign AI / EU in-region routing: https://openrouter.ai/docs/guides/features/sovereign-ai
- OpenRouter privacy policy: https://openrouter.ai/privacy
