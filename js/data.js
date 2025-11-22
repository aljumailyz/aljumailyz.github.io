export const sampleQuestions = [
  {
    id: 'cardio-001',
    stem:
      'A 64-year-old with long-standing hypertension presents with exertional dyspnea. Echo shows concentric LV hypertrophy with preserved EF. Which finding most supports HFpEF?',
    image:
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
    source: 'Cardio block',
    topic: 'Heart failure',
    difficulty: 'Moderate',
    mode: 'Timed',
    answers: [
      {
        id: 'a',
        text: 'Elevated BNP with impaired relaxation pattern on Doppler',
        isCorrect: true,
        explanation:
          'HFpEF shows diastolic dysfunction with concentric hypertrophy and preserved EF; BNP elevation supports congestion.',
      },
      {
        id: 'b',
        text: 'Reduced EF with eccentric hypertrophy',
        isCorrect: false,
        explanation: 'Reduced EF plus eccentric remodeling is classic HFrEF, not HFpEF.',
      },
      {
        id: 'c',
        text: 'Low voltage QRS with right axis deviation',
        isCorrect: false,
        explanation: 'Suggests COPD or infiltration, not diagnostic of HFpEF.',
      },
      {
        id: 'd',
        text: 'Holosystolic murmur at the apex radiating to axilla',
        isCorrect: false,
        explanation: 'Mitral regurgitation alone does not define HFpEF.',
      },
      {
        id: 'e',
        text: 'Wide pulse pressure with bounding pulses',
        isCorrect: false,
        explanation: 'Bounding pulses point to AR/high-output states.',
      },
      {
        id: 'f',
        text: 'S3 gallop with displaced PMI',
        isCorrect: false,
        explanation: 'S3 plus displaced PMI suggests volume overload/HFrEF.',
      },
    ],
  },
  {
    id: 'renal-004',
    stem:
      'A 26-year-old marathoner develops dark urine and elevated CK after a race. Which mechanism best explains the kidney injury?',
    image: '',
    source: 'Renal block',
    topic: 'AKI',
    difficulty: 'Easy',
    mode: 'Tutor',
    answers: [
      {
        id: 'a',
        text: 'Pigment-induced tubular necrosis from myoglobin',
        isCorrect: true,
        explanation: 'Rhabdo releases myoglobin causing ATN via tubular toxicity and cast formation.',
      },
      {
        id: 'b',
        text: 'Immune complex deposition in glomeruli',
        isCorrect: false,
        explanation: 'Immune complex GN is unrelated to exertional rhabdo.',
      },
      {
        id: 'c',
        text: 'Prerenal azotemia from renal artery stenosis',
        isCorrect: false,
        explanation: 'Renal artery stenosis is chronic and not triggered by a race.',
      },
      {
        id: 'd',
        text: 'Osmotic nephropathy from mannitol use',
        isCorrect: false,
        explanation: 'Mannitol is not mentioned and would be iatrogenic.',
      },
      {
        id: 'e',
        text: 'Postrenal obstruction from dehydration',
        isCorrect: false,
        explanation: 'Dehydration causes prerenal azotemia, not obstruction.',
      },
      {
        id: 'f',
        text: 'Thrombotic microangiopathy after infection',
        isCorrect: false,
        explanation: 'TMA is unrelated to exertional muscle injury.',
      },
    ],
  },
  {
    id: 'heme-010',
    stem:
      'A 54-year-old on imatinib for CML has new fatigue. Labs: Hb 9 g/dL, MCV 88, WBC 4k, Plt 190k, LDH normal. Which adverse effect explains the anemia?',
    image: '',
    source: 'Heme/Onc',
    topic: 'Myelosuppression',
    difficulty: 'Hard',
    mode: 'Timed',
    answers: [
      {
        id: 'a',
        text: 'BCR-ABL inhibition impairing erythroid progenitors',
        isCorrect: true,
        explanation: 'Imatinib can cause myelosuppression by affecting normal progenitors.',
      },
      {
        id: 'b',
        text: 'Immune-mediated hemolysis',
        isCorrect: false,
        explanation: 'Hemolysis would raise LDH/retic count; pattern here is marrow suppression.',
      },
      {
        id: 'c',
        text: 'Folate trapping from thymidylate synthase blockade',
        isCorrect: false,
        explanation: 'TS blockade relates to MTX/5-FU, not imatinib.',
      },
      {
        id: 'd',
        text: 'Microangiopathic hemolysis from endothelial injury',
        isCorrect: false,
        explanation: 'No schistocytes or thrombocytopenia to suggest MAHA.',
      },
      {
        id: 'e',
        text: 'Iron chelation leading to deficiency',
        isCorrect: false,
        explanation: 'Imatinib is not an iron chelator.',
      },
      {
        id: 'f',
        text: 'Suppression of hepatic EPO production',
        isCorrect: false,
        explanation: 'EPO is renal; imatinib does not suppress it.',
      },
    ],
  },
];
