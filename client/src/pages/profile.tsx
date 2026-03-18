import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, FileText, User, Briefcase, TestTube, PenTool } from "lucide-react";

interface ProfileData {
  aboutMe: string | null;
  cvText: string | null;
  cvFileName: string | null;
  cvFileData: string | null;
  cvUpdatedAt: string | null;
  careerTestResults: string | null;
  careerTestInterpretation: string | null;
  applicationStyle: string | null;
}

interface ApplicationStyle {
  grunntone: string;
  autoTilpasning: {
    formellOffentlig: boolean;
    formellFormeltSprak: boolean;
    mindreFormellMuntlig: boolean;
    lettHumor: boolean;
    humorBeskrivelse: string;
  };
  unnga: {
    smisking: boolean;
    gjentaStillingstekst: boolean;
    klisjer: boolean;
    fagjargon: boolean;
    privatInfo: boolean;
    andreTing: string;
  };
  skilleSeg: {
    nivaa: string;
    spesifikkSoknad: boolean;
    konkreteGrunner: boolean;
    selektivJobbsoking: boolean;
    mater: string;
  };
  alderLivsfase: {
    kategori: string;
    erfaren: {
      handling: string;
      framstilling: string;
      vitalitet: string;
    };
    yngre: {
      handling: string;
      formulering: string;
    };
  };
  kiSystem: {
    nevne: string;
    eksempelsetninger: string;
  };
  skryteliste: string;
  spesialregler: string;
}

const defaultApplicationStyle: ApplicationStyle = {
  grunntone: "noytral",
  autoTilpasning: {
    formellOffentlig: false,
    formellFormeltSprak: false,
    mindreFormellMuntlig: false,
    lettHumor: false,
    humorBeskrivelse: "",
  },
  unnga: {
    smisking: false,
    gjentaStillingstekst: false,
    klisjer: false,
    fagjargon: false,
    privatInfo: false,
    andreTing: "",
  },
  skilleSeg: {
    nivaa: "balansert",
    spesifikkSoknad: false,
    konkreteGrunner: false,
    selektivJobbsoking: false,
    mater: "",
  },
  alderLivsfase: {
    kategori: "ikke_relevant",
    erfaren: {
      handling: "balansert",
      framstilling: "",
      vitalitet: "",
    },
    yngre: {
      handling: "dempe",
      formulering: "",
    },
  },
  kiSystem: {
    nevne: "aldri",
    eksempelsetninger: "",
  },
  skryteliste: "",
  spesialregler: "",
};

export default function ProfilePage() {
  const { toast } = useToast();

  // Fetch profile data
  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Kunne ikke hente profil");
      return res.json();
    },
  });

  // State for each section
  const [aboutMe, setAboutMe] = useState("");
  const [cvText, setCvText] = useState("");
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [cvUpdatedAt, setCvUpdatedAt] = useState<string | null>(null);
  const [careerTestResults, setCareerTestResults] = useState("");
  const [careerTestInterpretation, setCareerTestInterpretation] = useState("");
  const [appStyle, setAppStyle] = useState<ApplicationStyle>(defaultApplicationStyle);

  // Load profile data into state
  useEffect(() => {
    if (profile) {
      setAboutMe(profile.aboutMe || "");
      setCvText(profile.cvText || "");
      setCvFileName(profile.cvFileName || null);
      setCvUpdatedAt(profile.cvUpdatedAt || null);
      setCareerTestResults(profile.careerTestResults || "");
      setCareerTestInterpretation(profile.careerTestInterpretation || "");
      if (profile.applicationStyle) {
        try {
          const parsed = JSON.parse(profile.applicationStyle);
          setAppStyle({ ...defaultApplicationStyle, ...parsed });
        } catch {
          setAppStyle(defaultApplicationStyle);
        }
      }
    }
  }, [profile]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("PATCH", "/api/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Lagret", description: "Endringene dine er lagret" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Feil", description: "Kunne ikke lagre endringene" });
    },
  });

  // CV upload mutation
  const cvUploadMutation = useMutation({
    mutationFn: async (data: { fileName: string; fileData: string }) => {
      const res = await apiRequest("POST", "/api/profile/cv-upload", data);
      return res.json();
    },
    onSuccess: (data) => {
      setCvFileName(data.cvFileName);
      setCvUpdatedAt(data.cvUpdatedAt);
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "CV lastet opp", description: `Fil: ${data.cvFileName}` });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Feil", description: "Kunne ikke laste opp CV" });
    },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      cvUploadMutation.mutate({ fileName: file.name, fileData: base64 });
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-semibold mb-6">Min profil</h1>

      <Tabs defaultValue="om-meg" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="om-meg" className="flex items-center gap-2 text-xs sm:text-sm">
            <User className="h-4 w-4 hidden sm:block" />
            Om meg
          </TabsTrigger>
          <TabsTrigger value="cv" className="flex items-center gap-2 text-xs sm:text-sm">
            <FileText className="h-4 w-4 hidden sm:block" />
            CV
          </TabsTrigger>
          <TabsTrigger value="karriere" className="flex items-center gap-2 text-xs sm:text-sm">
            <TestTube className="h-4 w-4 hidden sm:block" />
            Karrierepasset
          </TabsTrigger>
          <TabsTrigger value="soknadsstil" className="flex items-center gap-2 text-xs sm:text-sm">
            <PenTool className="h-4 w-4 hidden sm:block" />
            Søknadsstil
          </TabsTrigger>
        </TabsList>

        {/* === OM MEG === */}
        <TabsContent value="om-meg">
          <Card>
            <CardHeader>
              <CardTitle>Fortell om deg selv</CardTitle>
              <CardDescription>
                Dette er det viktigste feltet i profilen din. Teksten du skriver her brukes hver gang systemet
                foreslår jobber eller skriver søknader — også hvis du ikke har CV eller tester.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={aboutMe}
                onChange={(e) => setAboutMe(e.target.value)}
                placeholder="Fortell om deg selv her..."
                className="min-h-[200px]"
              />
              <div className="space-y-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
                <p className="font-medium text-foreground">Tenk over disse spørsmålene:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Hvordan vil du beskrive deg selv til en arbeidsgiver som aldri har møtt deg før?</li>
                  <li>Hva er du spesielt god til (fra skole, jobb, frivillig arbeid eller privatlivet)?</li>
                  <li>Hva liker du best å jobbe med (oppgaver, mennesker, fagområder)?</li>
                  <li>Hvilke typer jobber eller arbeidsmiljøer tror du passer deg godt — og hvilke passer dårlig?</li>
                  <li>Er det noe spesielt med bakgrunnen din det er viktig at systemet husker (f.eks. hull i CV, omskolering, helse, omsorgsansvar, flytting osv.)?</li>
                  <li>Hvordan ønsker du å framstå i søknader (nøktern, direkte, varm, kreativ, faglig tung, humoristisk osv.)?</li>
                </ul>
                <p className="mt-2 italic">Anbefaling: skriv minst 5–10 setninger. Du kan alltid komme tilbake og endre.</p>
              </div>
              <Button
                onClick={() => saveMutation.mutate({ aboutMe })}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lagre
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === CV === */}
        <TabsContent value="cv">
          <Card>
            <CardHeader>
              <CardTitle>CV (valgfritt)</CardTitle>
              <CardDescription>
                Hvis du har CV, kan du laste den opp eller lime inn teksten. CVen brukes til mer presise
                jobbforslag og søknader. Det er helt greit å hoppe over dette, spesielt for yngre eller de uten
                formell CV.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* File upload */}
              <div className="space-y-3">
                <Label className="font-medium">Last opp CV-fil (PDF/Word)</Label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={cvUploadMutation.isPending}
                  >
                    {cvUploadMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {cvFileName ? "Bytt CV" : "Last opp fil"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
                {cvFileName && (
                  <p className="text-sm text-muted-foreground">
                    Sist oppdatert: {cvUpdatedAt ? new Date(cvUpdatedAt).toLocaleDateString("nb-NO") : "–"} — Fil: {cvFileName}
                  </p>
                )}
              </div>

              {/* Text paste */}
              <div className="space-y-2">
                <Label className="font-medium">Eller lim inn CV-tekst</Label>
                <Textarea
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                  placeholder="Lim inn CV-teksten din her..."
                  className="min-h-[200px]"
                />
              </div>
              <Button
                onClick={() => saveMutation.mutate({ cvText })}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lagre
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === KARRIEREPASSET === */}
        <TabsContent value="karriere">
          <Card>
            <CardHeader>
              <CardTitle>Karrierepasset og andre tester (valgfritt)</CardTitle>
              <CardDescription>
                Her kan du lime inn nøkkelinnhold fra Karrierepasset.no eller andre tester. Dette brukes til å
                forstå dine styrker og interesser, foreslå overraskende men relevante jobber, og vinkle søknader.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="font-medium">Resultater fra Karrierepasset.no / andre tester</Label>
                <Textarea
                  value={careerTestResults}
                  onChange={(e) => setCareerTestResults(e.target.value)}
                  placeholder="Lim inn testresultatene dine her..."
                  className="min-h-[150px]"
                />
                <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-1">
                  <p>Tenk over:</p>
                  <ul className="list-disc list-inside">
                    <li>Hva sier testen om dine sterkeste sider og personlige egenskaper?</li>
                    <li>Hvilke typer jobber, roller eller oppgaver anbefales?</li>
                    <li>Hva kjenner du deg mest igjen i / minst igjen i?</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-medium">Min egen tolkning av testene</Label>
                <Textarea
                  value={careerTestInterpretation}
                  onChange={(e) => setCareerTestInterpretation(e.target.value)}
                  placeholder="Beskriv med egne ord hva som er viktig å ta med, og hva som bør tones ned."
                  className="min-h-[100px]"
                />
              </div>
              <Button
                onClick={() =>
                  saveMutation.mutate({ careerTestResults, careerTestInterpretation })
                }
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lagre
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === SØKNADSSTIL === */}
        <TabsContent value="soknadsstil">
          <Card>
            <CardHeader>
              <CardTitle>Søknadsstil og regler</CardTitle>
              <CardDescription>
                Her styrer du hvordan søknadene dine skal skrives. Juster tone, stil og spesialregler.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {/* 2.4.1 Grunntone */}
                <AccordionItem value="grunntone">
                  <AccordionTrigger>1. Grunntone</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      <RadioGroup
                        value={appStyle.grunntone}
                        onValueChange={(v) => setAppStyle({ ...appStyle, grunntone: v })}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="formell" id="tone-formell" />
                          <Label htmlFor="tone-formell">Formell og saklig</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="noytral" id="tone-noytral" />
                          <Label htmlFor="tone-noytral">Nøytral, profesjonell, litt personlig</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="varm" id="tone-varm" />
                          <Label htmlFor="tone-varm">Varm og personlig, men fortsatt profesjonell</Label>
                        </div>
                      </RadioGroup>
                      <p className="text-sm text-muted-foreground italic">
                        Systemet kan likevel overstyre tonen basert på annonsen.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 2.4.2 Automatisk tilpasning */}
                <AccordionItem value="auto-tilpasning">
                  <AccordionTrigger>2. Automatisk tilpasning til annonsen</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <SwitchField
                        label="Bruk formell tone ved offentlige stillinger"
                        checked={appStyle.autoTilpasning.formellOffentlig}
                        onChange={(v) =>
                          setAppStyle({
                            ...appStyle,
                            autoTilpasning: { ...appStyle.autoTilpasning, formellOffentlig: v },
                          })
                        }
                      />
                      <SwitchField
                        label="Bruk formell tone ved annonser med tydelig formelt språk"
                        checked={appStyle.autoTilpasning.formellFormeltSprak}
                        onChange={(v) =>
                          setAppStyle({
                            ...appStyle,
                            autoTilpasning: { ...appStyle.autoTilpasning, formellFormeltSprak: v },
                          })
                        }
                      />
                      <SwitchField
                        label="Bruk mindre formell tone ved muntlige/uformelle annonser"
                        checked={appStyle.autoTilpasning.mindreFormellMuntlig}
                        onChange={(v) =>
                          setAppStyle({
                            ...appStyle,
                            autoTilpasning: { ...appStyle.autoTilpasning, mindreFormellMuntlig: v },
                          })
                        }
                      />
                      <SwitchField
                        label="Tillat lett humor når annonsen virker uformell og rollen tåler det"
                        checked={appStyle.autoTilpasning.lettHumor}
                        onChange={(v) =>
                          setAppStyle({
                            ...appStyle,
                            autoTilpasning: { ...appStyle.autoTilpasning, lettHumor: v },
                          })
                        }
                      />
                      <div className="space-y-2">
                        <Label>Hvordan skal humor brukes?</Label>
                        <Textarea
                          value={appStyle.autoTilpasning.humorBeskrivelse}
                          onChange={(e) =>
                            setAppStyle({
                              ...appStyle,
                              autoTilpasning: { ...appStyle.autoTilpasning, humorBeskrivelse: e.target.value },
                            })
                          }
                          placeholder="Mengde, plassering, hva som bør unngås..."
                          className="min-h-[80px]"
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 2.4.3 Ting som skal unngås */}
                <AccordionItem value="unnga">
                  <AccordionTrigger>3. Ting som skal unngås</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <CheckboxField
                        label="Unngå smisking og overdreven ros"
                        checked={appStyle.unnga.smisking}
                        onChange={(v) =>
                          setAppStyle({ ...appStyle, unnga: { ...appStyle.unnga, smisking: v } })
                        }
                      />
                      <CheckboxField
                        label="Ikke gjenta stillingsteksten ordrett"
                        checked={appStyle.unnga.gjentaStillingstekst}
                        onChange={(v) =>
                          setAppStyle({
                            ...appStyle,
                            unnga: { ...appStyle.unnga, gjentaStillingstekst: v },
                          })
                        }
                      />
                      <CheckboxField
                        label="Unngå klisjeer og tomme fraser uten konkrete eksempler"
                        checked={appStyle.unnga.klisjer}
                        onChange={(v) =>
                          setAppStyle({ ...appStyle, unnga: { ...appStyle.unnga, klisjer: v } })
                        }
                      />
                      <CheckboxField
                        label="Unngå for mye fagjargon"
                        checked={appStyle.unnga.fagjargon}
                        onChange={(v) =>
                          setAppStyle({ ...appStyle, unnga: { ...appStyle.unnga, fagjargon: v } })
                        }
                      />
                      <CheckboxField
                        label="Unngå for privat informasjon"
                        checked={appStyle.unnga.privatInfo}
                        onChange={(v) =>
                          setAppStyle({ ...appStyle, unnga: { ...appStyle.unnga, privatInfo: v } })
                        }
                      />
                      <div className="space-y-2">
                        <Label>Andre ting jeg vil unngå</Label>
                        <Textarea
                          value={appStyle.unnga.andreTing}
                          onChange={(e) =>
                            setAppStyle({
                              ...appStyle,
                              unnga: { ...appStyle.unnga, andreTing: e.target.value },
                            })
                          }
                          placeholder="Ord, uttrykk, stiltrekk du misliker..."
                          className="min-h-[80px]"
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 2.4.4 Skille seg ut */}
                <AccordionItem value="skille-seg">
                  <AccordionTrigger>4. Skille seg ut og «ikke plikt-søknad»</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="font-medium">Hvor mye skal du skille deg ut?</Label>
                        <RadioGroup
                          value={appStyle.skilleSeg.nivaa}
                          onValueChange={(v) =>
                            setAppStyle({ ...appStyle, skilleSeg: { ...appStyle.skilleSeg, nivaa: v } })
                          }
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="noktern" id="skille-noktern" />
                            <Label htmlFor="skille-noktern">Nøktern og trygg</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="balansert" id="skille-balansert" />
                            <Label htmlFor="skille-balansert">Balansert (noen særtrekk)</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="annerledes" id="skille-annerledes" />
                            <Label htmlFor="skille-annerledes">Tydelig annerledes (mer direkte, kreativ, personlig)</Label>
                          </div>
                        </RadioGroup>
                      </div>
                      <SwitchField
                        label="Alltid vise at søknaden er skrevet spesifikt for denne stillingen"
                        checked={appStyle.skilleSeg.spesifikkSoknad}
                        onChange={(v) =>
                          setAppStyle({
                            ...appStyle,
                            skilleSeg: { ...appStyle.skilleSeg, spesifikkSoknad: v },
                          })
                        }
                      />
                      <SwitchField
                        label="Alltid ta med 1–2 konkrete grunner til hvorfor akkurat denne arbeidsgiveren/rollen er valgt"
                        checked={appStyle.skilleSeg.konkreteGrunner}
                        onChange={(v) =>
                          setAppStyle({
                            ...appStyle,
                            skilleSeg: { ...appStyle.skilleSeg, konkreteGrunner: v },
                          })
                        }
                      />
                      <SwitchField
                        label="Formulere at jeg er selektiv i jobbsøkingen (uten å nevne NAV/plikt)"
                        checked={appStyle.skilleSeg.selektivJobbsoking}
                        onChange={(v) =>
                          setAppStyle({
                            ...appStyle,
                            skilleSeg: { ...appStyle.skilleSeg, selektivJobbsoking: v },
                          })
                        }
                      />
                      <div className="space-y-2">
                        <Label>Måter søknaden kan skille seg ut på som jeg liker</Label>
                        <Textarea
                          value={appStyle.skilleSeg.mater}
                          onChange={(e) =>
                            setAppStyle({
                              ...appStyle,
                              skilleSeg: { ...appStyle.skilleSeg, mater: e.target.value },
                            })
                          }
                          placeholder="Beskriv måter du liker at søknaden skiller seg ut..."
                          className="min-h-[80px]"
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 2.4.5 Alder og livsfase */}
                <AccordionItem value="alder">
                  <AccordionTrigger>5. Alder og livsfase</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <RadioGroup
                        value={appStyle.alderLivsfase.kategori}
                        onValueChange={(v) =>
                          setAppStyle({
                            ...appStyle,
                            alderLivsfase: { ...appStyle.alderLivsfase, kategori: v },
                          })
                        }
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="erfaren" id="alder-erfaren" />
                          <Label htmlFor="alder-erfaren">Erfaren kandidat (50+)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="yngre" id="alder-yngre" />
                          <Label htmlFor="alder-yngre">Yngre kandidat</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="ikke_relevant" id="alder-irrelevant" />
                          <Label htmlFor="alder-irrelevant">Ikke relevant / vil ikke spesifisere</Label>
                        </div>
                      </RadioGroup>

                      {appStyle.alderLivsfase.kategori === "erfaren" && (
                        <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                          <div className="space-y-2">
                            <Label className="font-medium">Hvordan håndtere alder?</Label>
                            <RadioGroup
                              value={appStyle.alderLivsfase.erfaren.handling}
                              onValueChange={(v) =>
                                setAppStyle({
                                  ...appStyle,
                                  alderLivsfase: {
                                    ...appStyle.alderLivsfase,
                                    erfaren: { ...appStyle.alderLivsfase.erfaren, handling: v },
                                  },
                                })
                              }
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="diskret" id="erfaren-diskret" />
                                <Label htmlFor="erfaren-diskret">Diskret</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="balansert" id="erfaren-balansert" />
                                <Label htmlFor="erfaren-balansert">Balansert</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="tydelig" id="erfaren-tydelig" />
                                <Label htmlFor="erfaren-tydelig">Tydelig</Label>
                              </div>
                            </RadioGroup>
                          </div>
                          <div className="space-y-2">
                            <Label>Hvordan skal lang erfaring framstilles som styrke?</Label>
                            <Textarea
                              value={appStyle.alderLivsfase.erfaren.framstilling}
                              onChange={(e) =>
                                setAppStyle({
                                  ...appStyle,
                                  alderLivsfase: {
                                    ...appStyle.alderLivsfase,
                                    erfaren: { ...appStyle.alderLivsfase.erfaren, framstilling: e.target.value },
                                  },
                                })
                              }
                              placeholder="Beskriv hvordan erfaring skal framheves..."
                              className="min-h-[80px]"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Eksempler på vitalitet og læringsvilje</Label>
                            <Textarea
                              value={appStyle.alderLivsfase.erfaren.vitalitet}
                              onChange={(e) =>
                                setAppStyle({
                                  ...appStyle,
                                  alderLivsfase: {
                                    ...appStyle.alderLivsfase,
                                    erfaren: { ...appStyle.alderLivsfase.erfaren, vitalitet: e.target.value },
                                  },
                                })
                              }
                              placeholder="Fysisk krevende erfaringer, ny teknologi osv."
                              className="min-h-[80px]"
                            />
                          </div>
                        </div>
                      )}

                      {appStyle.alderLivsfase.kategori === "yngre" && (
                        <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                          <RadioGroup
                            value={appStyle.alderLivsfase.yngre.handling}
                            onValueChange={(v) =>
                              setAppStyle({
                                ...appStyle,
                                alderLivsfase: {
                                  ...appStyle.alderLivsfase,
                                  yngre: { ...appStyle.alderLivsfase.yngre, handling: v },
                                },
                              })
                            }
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="dempe" id="yngre-dempe" />
                              <Label htmlFor="yngre-dempe">Dempe fokus på ung alder</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="styrke" id="yngre-styrke" />
                              <Label htmlFor="yngre-styrke">Bruke ung alder som styrke</Label>
                            </div>
                          </RadioGroup>
                          <div className="space-y-2">
                            <Label>Ønsket formulering rundt alder</Label>
                            <Textarea
                              value={appStyle.alderLivsfase.yngre.formulering}
                              onChange={(e) =>
                                setAppStyle({
                                  ...appStyle,
                                  alderLivsfase: {
                                    ...appStyle.alderLivsfase,
                                    yngre: { ...appStyle.alderLivsfase.yngre, formulering: e.target.value },
                                  },
                                })
                              }
                              placeholder="Beskriv ønsket formulering..."
                              className="min-h-[80px]"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 2.4.6 KI-system */}
                <AccordionItem value="ki-system">
                  <AccordionTrigger>6. Nevne eget KI-system</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <RadioGroup
                        value={appStyle.kiSystem.nevne}
                        onValueChange={(v) =>
                          setAppStyle({ ...appStyle, kiSystem: { ...appStyle.kiSystem, nevne: v } })
                        }
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="aldri" id="ki-aldri" />
                          <Label htmlFor="ki-aldri">Aldri nevne systemet</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="tech" id="ki-tech" />
                          <Label htmlFor="ki-tech">Bare nevne det i tech/innovasjonsroller</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="fordel" id="ki-fordel" />
                          <Label htmlFor="ki-fordel">Nevne det når det kan gi fordel (vise initiativ og KI-kompetanse)</Label>
                        </div>
                      </RadioGroup>
                      <div className="space-y-2">
                        <Label>Eksempelsetninger systemet kan variere over (nøktern stil)</Label>
                        <Textarea
                          value={appStyle.kiSystem.eksempelsetninger}
                          onChange={(e) =>
                            setAppStyle({
                              ...appStyle,
                              kiSystem: { ...appStyle.kiSystem, eksempelsetninger: e.target.value },
                            })
                          }
                          placeholder="Skriv eksempelsetninger her..."
                          className="min-h-[80px]"
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 2.4.7 Skryteliste */}
                <AccordionItem value="skryteliste">
                  <AccordionTrigger>7. Skryteliste</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      <Label>Ting som er verdt å framheve (erfaringer, prosjekter, kurs, resultater)</Label>
                      <Textarea
                        value={appStyle.skryteliste}
                        onChange={(e) => setAppStyle({ ...appStyle, skryteliste: e.target.value })}
                        placeholder="- Erfaring 1&#10;- Prosjekt 2&#10;- Kurs 3&#10;..."
                        className="min-h-[120px]"
                      />
                      <p className="text-sm text-muted-foreground italic">
                        Systemet velger kun relevante punkter per stilling — ikke alt brukes hver gang.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 2.4.8 Spesialregler */}
                <AccordionItem value="spesialregler">
                  <AccordionTrigger>8. Spesialregler</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      <Label>Egne spesialregler for søknadene mine</Label>
                      <Textarea
                        value={appStyle.spesialregler}
                        onChange={(e) => setAppStyle({ ...appStyle, spesialregler: e.target.value })}
                        placeholder="Finjustering av ærlighetsnivå, ekstra varme i visse typer jobber osv."
                        className="min-h-[100px]"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="mt-6">
                <Button
                  onClick={() =>
                    saveMutation.mutate({ applicationStyle: JSON.stringify(appStyle) })
                  }
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Lagre søknadsstil
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper components
function SwitchField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="flex-1 cursor-pointer">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center space-x-2">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <Label className="cursor-pointer">{label}</Label>
    </div>
  );
}
