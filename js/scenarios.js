/*
 * Demo packages. Every company name and price here is synthetic (SENTETİK ÖRNEK VERİ)
 * and exists only to show how the engine treats different quote shapes.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RFQScenarios = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return [
  {
    id: "pkt01_rebar",
    code: "PKT-01",
    category: "STRUCTURAL",
    quick: true,
    title: {
      tr: "100 Ton Nervürlü İnşaat Demiri (S420)",
      en: "100 Tons Ribbed Rebar (S420)"
    },
    summary: {
      tr: "4 çap grubu; fabrika peşin, şantiye çekli, Euro vadeli ve boy fiyatı KDV dahil (eksik kalemli) 4 teklif.",
      en: "4 diameter groups; factory cash, on-site cheques, EUR deferred, and a per-bar VAT-inclusive quote with a missing line."
    },
    items: [
      {
        id: "reb_1",
        name: {
          tr: "Ø8 - Ø10 Nervürlü İnşaat Demiri (S420)",
          en: "Ø8 - Ø10 Ribbed Steel Rebar (S420)"
        },
        qty: 15,
        unit: {
          tr: "Ton",
          en: "Tons"
        }
      },
      {
        id: "reb_2",
        name: {
          tr: "Ø12 Nervürlü İnşaat Demiri (S420)",
          en: "Ø12 Ribbed Steel Rebar (S420)"
        },
        qty: 25,
        unit: {
          tr: "Ton",
          en: "Tons"
        },
        diameter: 12
      },
      {
        id: "reb_3",
        name: {
          tr: "Ø16 Nervürlü İnşaat Demiri (S420)",
          en: "Ø16 Ribbed Steel Rebar (S420)"
        },
        qty: 35,
        unit: {
          tr: "Ton",
          en: "Tons"
        },
        diameter: 16
      },
      {
        id: "reb_4",
        name: {
          tr: "Ø20 - Ø32 Nervürlü İnşaat Demiri (S420)",
          en: "Ø20 - Ø32 Heavy Ribbed Rebar (S420)"
        },
        qty: 25,
        unit: {
          tr: "Ton",
          en: "Tons"
        }
      }
    ],
    suppliers: [
      {
        id: "reb_sup1",
        name: {
          tr: "Firma A (Fabrika Peşin)",
          en: "Supplier A (Factory Cash)"
        },
        currency: "TRY",
        delivery: "factory_exw",
        transportTRY: 95000,
        craneTRY: 22000,
        wastePct: 0,
        vatIncluded: false,
        preset: "cash",
        prices: {
          reb_1: 30900,
          reb_2: 30300,
          reb_3: 29900,
          reb_4: 29700
        }
      },
      {
        id: "reb_sup2",
        name: {
          tr: "Firma B (Şantiye 30-60-90 Çek)",
          en: "Supplier B (On-Site 30-60-90D Check)"
        },
        currency: "TRY",
        delivery: "site_no_crane",
        transportTRY: 0,
        craneTRY: 22000,
        wastePct: 0,
        vatIncluded: false,
        preset: "30_60_90",
        prices: {
          reb_1: 33600,
          reb_2: 33100,
          reb_3: 32550,
          reb_4: 32380
        }
      },
      {
        id: "reb_sup3",
        name: {
          tr: "Firma C (EUR Vadeli İstif)",
          en: "Supplier C (EUR Deferred Stacked)"
        },
        currency: "EUR",
        delivery: "site_stacked",
        transportTRY: 0,
        craneTRY: 0,
        wastePct: 0,
        vatIncluded: false,
        preset: "adv30_60",
        prices: {
          reb_1: 845,
          reb_2: 830,
          reb_3: 815,
          reb_4: 810
        }
      },
      {
        id: "reb_sup4",
        name: {
          tr: "Firma D (Boy Fiyatı, KDV Dahil, 45 Gün)",
          en: "Supplier D (Per Bar, VAT Incl., 45 Days)"
        },
        currency: "TRY",
        delivery: "site_stacked",
        transportTRY: 0,
        craneTRY: 0,
        wastePct: 0,
        vatIncluded: true,
        preset: "single_45",
        prices: {
          reb_1: 37380,
          reb_2: 388.39,
          reb_3: 681.39,
          reb_4: null
        },
        units: {
          reb_2: {
            tr: "Boy",
            en: "Bar"
          },
          reb_3: {
            tr: "Boy",
            en: "Bar"
          }
        }
      }
    ]
  },
  {
    id: "pkt02_concrete",
    code: "PKT-02",
    category: "STRUCTURAL",
    quick: false,
    title: {
      tr: "2.500 m³ C30/37 Hazır Beton ve Pompa",
      en: "2,500 m³ C30/37 Ready-Mix Concrete & Pump"
    },
    summary: {
      tr: "C30/37 Yapısal Beton, C20/25 Grobeton, 47m Mobil Pompa ve Antifriz/Katkı farkları.",
      en: "C30/37 Structural Concrete, C20/25 Lean Concrete, 47m Mobile Pump, and Admixture extras."
    },
    items: [
      {
        id: "con_1",
        name: {
          tr: "C30/37 Hazır Beton (S4 Kıvam, Pompalı)",
          en: "C30/37 Structural Ready-Mix Concrete (S4)"
        },
        qty: 2100,
        unit: {
          tr: "m³",
          en: "m³"
        }
      },
      {
        id: "con_2",
        name: {
          tr: "C20/25 Temel Altı Grobeton (Mikserli)",
          en: "C20/25 Sub-Base Lean Concrete"
        },
        qty: 400,
        unit: {
          tr: "m³",
          en: "m³"
        }
      },
      {
        id: "con_3",
        name: {
          tr: "47m - 52m Uzun Bomlu Mobil Pompa Hizmeti",
          en: "47m - 52m Long-Boom Mobile Pump Service"
        },
        qty: 2100,
        unit: {
          tr: "m³",
          en: "m³"
        }
      },
      {
        id: "con_4",
        name: {
          tr: "Sentetik Lif ve Süperakışkanlaştırıcı Katkı",
          en: "Synthetic Fiber & Superplasticizer Admixture"
        },
        qty: 1500,
        unit: {
          tr: "m³",
          en: "m³"
        }
      }
    ],
    suppliers: [
      {
        id: "con_sup1",
        name: {
          tr: "Firma A (Peşin İskontolu)",
          en: "Supplier A (Cash Discounted)"
        },
        currency: "TRY",
        delivery: "site_stacked",
        transportTRY: 0,
        craneTRY: 0,
        wastePct: 1.5,
        vatIncluded: false,
        preset: "cash",
        prices: {
          con_1: 2850,
          con_2: 2420,
          con_3: 180,
          con_4: 90
        }
      },
      {
        id: "con_sup2",
        name: {
          tr: "Firma B (30-60-90 Gün Çek)",
          en: "Supplier B (30-60-90D Equal Check)"
        },
        currency: "TRY",
        delivery: "site_stacked",
        transportTRY: 0,
        craneTRY: 0,
        wastePct: 1,
        vatIncluded: false,
        preset: "30_60_90",
        prices: {
          con_1: 3110,
          con_2: 2650,
          con_3: 160,
          con_4: 100
        }
      },
      {
        id: "con_sup3",
        name: {
          tr: "Firma C (90 Gün Tek Çek)",
          en: "Supplier C (90D Single Check)"
        },
        currency: "TRY",
        delivery: "site_stacked",
        transportTRY: 35000,
        craneTRY: 0,
        wastePct: 1.5,
        vatIncluded: false,
        preset: "single_90",
        prices: {
          con_1: 3220,
          con_2: 2740,
          con_3: 185,
          con_4: 85
        }
      }
    ]
  },
  {
    id: "pkt03_ceramic",
    code: "PKT-03",
    category: "ARCHITECTURAL",
    quick: true,
    title: {
      tr: "5.000 m² Porselen Seramik ve Yapıştırıcı",
      en: "5,000 m² Porcelain Tile & Adhesive"
    },
    summary: {
      tr: "60x120 rektifiyeli porselen seramik, 30x60 duvar seramiği, esnek yapıştırıcı ve derz dolgu.",
      en: "60x120 rectified floor porcelain, 30x60 wall tiles, flexible adhesive, and joint grout."
    },
    items: [
      {
        id: "cer_1",
        name: {
          tr: "60x120 Mat Rektifiyeli Porselen Yer Seramiği",
          en: "60x120 Matte Rectified Floor Porcelain Tile"
        },
        qty: 5000,
        unit: {
          tr: "m²",
          en: "m²"
        }
      },
      {
        id: "cer_2",
        name: {
          tr: "30x60 Islak Hacim Duvar Seramiği (1. Kalite)",
          en: "30x60 Wet Area Wall Ceramic Tile (Grade 1)"
        },
        qty: 1800,
        unit: {
          tr: "m²",
          en: "m²"
        }
      },
      {
        id: "cer_3",
        name: {
          tr: "C2TE S1 Tam Esnek Seramik Yapıştırıcısı (25kg)",
          en: "C2TE S1 Full-Flex Tile Adhesive (25kg Bag)"
        },
        qty: 1450,
        unit: {
          tr: "Torba",
          en: "Bags"
        }
      },
      {
        id: "cer_4",
        name: {
          tr: "CG2WA Silikonlu Derz Dolgu (20kg)",
          en: "CG2WA Silicone Joint Grout (20kg)"
        },
        qty: 220,
        unit: {
          tr: "Torba",
          en: "Bags"
        }
      }
    ],
    suppliers: [
      {
        id: "cer_sup1",
        name: {
          tr: "Firma A (Fabrika Peşin)",
          en: "Supplier A (Factory Cash)"
        },
        currency: "TRY",
        delivery: "factory_exw",
        transportTRY: 145000,
        craneTRY: 38000,
        wastePct: 2.5,
        vatIncluded: false,
        preset: "cash",
        prices: {
          cer_1: 465,
          cer_2: 315,
          cer_3: 245,
          cer_4: 380
        }
      },
      {
        id: "cer_sup2",
        name: {
          tr: "Firma B (30-60-90 Gün Çek)",
          en: "Supplier B (30-60-90D Check)"
        },
        currency: "TRY",
        delivery: "site_stacked",
        transportTRY: 0,
        craneTRY: 0,
        wastePct: 1,
        vatIncluded: false,
        preset: "30_60_90",
        prices: {
          cer_1: 525,
          cer_2: 350,
          cer_3: 260,
          cer_4: 410
        }
      },
      {
        id: "cer_sup3",
        name: {
          tr: "Firma C (90 Gün Tek Çek)",
          en: "Supplier C (90D Single Check)"
        },
        currency: "TRY",
        delivery: "site_no_crane",
        transportTRY: 0,
        craneTRY: 28000,
        wastePct: 1,
        vatIncluded: false,
        preset: "single_90",
        prices: {
          cer_1: 550,
          cer_2: 355,
          cer_3: 238,
          cer_4: 395
        }
      }
    ]
  },
  {
    id: "pkt04_mechanical",
    code: "PKT-04",
    category: "MEP",
    quick: true,
    title: {
      tr: "Mekanik Tesisat, Chiller ve Borulama",
      en: "HVAC Chiller & Piping Package"
    },
    summary: {
      tr: "450 kW Hava Soğutmalı Chiller, 4 Borulu Fan-Coil, DN100 Çelik Boru ve Kauçuk İzolasyon.",
      en: "450 kW Air-Cooled Screw Chiller, 4-Pipe Fan-Coils, DN100 Steel Pipe, and Elastomeric Insulation."
    },
    items: [
      {
        id: "mec_1",
        name: {
          tr: "450 kW Hava Soğutmalı Vidalı Chiller Grubu",
          en: "450 kW Air-Cooled Screw Chiller Unit"
        },
        qty: 2,
        unit: {
          tr: "Adet",
          en: "Units"
        }
      },
      {
        id: "mec_2",
        name: {
          tr: "Gizli Tavan Tipi 4 Borulu Fan-Coil Cihazı",
          en: "Concealed Ceiling 4-Pipe Fan-Coil Unit"
        },
        qty: 65,
        unit: {
          tr: "Adet",
          en: "Units"
        }
      },
      {
        id: "mec_3",
        name: {
          tr: "DN100 Dikişsiz Çelik Tesisat Borusu (Sch40)",
          en: "DN100 Seamless Steel HVAC Pipe (Sch40)"
        },
        qty: 1800,
        unit: {
          tr: "mt",
          en: "m"
        }
      },
      {
        id: "mec_4",
        name: {
          tr: "25mm Kauçuk Köpüğü Boru İzolasyonu ve Vana Grubu",
          en: "25mm Elastomeric Pipe Insulation & Valve Set"
        },
        qty: 1800,
        unit: {
          tr: "mt",
          en: "m"
        }
      }
    ],
    suppliers: [
      {
        id: "mec_sup1",
        name: {
          tr: "Firma A (Fabrika Peşin)",
          en: "Supplier A (Factory Cash)"
        },
        currency: "TRY",
        delivery: "factory_exw",
        transportTRY: 115000,
        craneTRY: 48000,
        wastePct: 1,
        vatIncluded: false,
        preset: "cash",
        prices: {
          mec_1: 1420000,
          mec_2: 14800,
          mec_3: 890,
          mec_4: 240
        }
      },
      {
        id: "mec_sup2",
        name: {
          tr: "Firma B (30-60-90 Çek)",
          en: "Supplier B (30-60-90D Check)"
        },
        currency: "TRY",
        delivery: "site_stacked",
        transportTRY: 0,
        craneTRY: 0,
        wastePct: 0,
        vatIncluded: false,
        preset: "30_60_90",
        prices: {
          mec_1: 1560000,
          mec_2: 16200,
          mec_3: 980,
          mec_4: 265
        }
      },
      {
        id: "mec_sup3",
        name: {
          tr: "Firma C (%30 Avans + 60G EUR)",
          en: "Supplier C (30% Adv + 60D EUR)"
        },
        currency: "EUR",
        delivery: "site_no_crane",
        transportTRY: 0,
        craneTRY: 45000,
        wastePct: 0,
        vatIncluded: false,
        preset: "adv30_60",
        prices: {
          mec_1: 39200,
          mec_2: 405,
          mec_3: 24.5,
          mec_4: 6.6
        }
      }
    ]
  },
  {
    id: "pkt05_electrical",
    code: "PKT-05",
    category: "MEP",
    quick: false,
    title: {
      tr: "Elektrik Ana Pano, Kablo ve Tava Paketi",
      en: "Main Switchgear, Cables & Trays"
    },
    summary: {
      tr: "36kV OG Kesicili Hücre, 2500A Ana Dağıtım Panosu, 4x150mm² N2XH Kablo ve Galvaniz Tava.",
      en: "36kV MV Switchgear, 2500A Main Distribution Panel, 4x150mm² N2XH Cable, and Galvanized Tray."
    },
    items: [
      {
        id: "elc_1",
        name: {
          tr: "36kV 630A 16kA SF6 Gazlı OG Kesicili Hücre",
          en: "36kV 630A 16kA SF6 MV Circuit Breaker Cubicle"
        },
        qty: 4,
        unit: {
          tr: "Adet",
          en: "Pcs"
        }
      },
      {
        id: "elc_2",
        name: {
          tr: "2500A Dikili Tip Ana Dağıtım Panosu (Form 3b)",
          en: "2500A Main Distribution Board (Form 3b)"
        },
        qty: 2,
        unit: {
          tr: "Takım",
          en: "Sets"
        }
      },
      {
        id: "elc_3",
        name: {
          tr: "0.6/1kV 4x150/70mm² N2XH Halojensiz Bakır Kablo",
          en: "0.6/1kV 4x150/70mm² N2XH Halogen-Free Copper Cable"
        },
        qty: 1200,
        unit: {
          tr: "mt",
          en: "m"
        }
      },
      {
        id: "elc_4",
        name: {
          tr: "300x60mm Sıcak Daldırma Galvaniz Ağır Hizmet Tava",
          en: "300x60mm Hot-Dip Galvanized Heavy Cable Tray"
        },
        qty: 1500,
        unit: {
          tr: "mt",
          en: "m"
        }
      }
    ],
    suppliers: [
      {
        id: "elc_sup1",
        name: {
          tr: "Firma A (Fabrika Peşin)",
          en: "Supplier A (Factory Cash)"
        },
        currency: "TRY",
        delivery: "factory_exw",
        transportTRY: 110000,
        craneTRY: 35000,
        wastePct: 2,
        vatIncluded: false,
        preset: "cash",
        prices: {
          elc_1: 295000,
          elc_2: 680000,
          elc_3: 1850,
          elc_4: 440
        }
      },
      {
        id: "elc_sup2",
        name: {
          tr: "Firma B (30-60-90 Çek)",
          en: "Supplier B (30-60-90D Check)"
        },
        currency: "TRY",
        delivery: "site_stacked",
        transportTRY: 0,
        craneTRY: 0,
        wastePct: 0,
        vatIncluded: false,
        preset: "30_60_90",
        prices: {
          elc_1: 325000,
          elc_2: 745000,
          elc_3: 2060,
          elc_4: 485
        }
      },
      {
        id: "elc_sup3",
        name: {
          tr: "Firma C (%30 Avans + 60G EUR)",
          en: "Supplier C (30% Adv + 60D EUR)"
        },
        currency: "EUR",
        delivery: "site_no_crane",
        transportTRY: 0,
        craneTRY: 25000,
        wastePct: 0,
        vatIncluded: false,
        preset: "adv30_60",
        prices: {
          elc_1: 8100,
          elc_2: 18600,
          elc_3: 51.5,
          elc_4: 12.2
        }
      }
    ]
  },
  {
    id: "pkt06_insulation",
    code: "PKT-06",
    category: "ARCHITECTURAL",
    quick: false,
    title: {
      tr: "8.000 m² Dış Cephe Taşyünü Mantolama ve Boya",
      en: "8,000 m² Exterior Rockwool Insulation & Paint"
    },
    summary: {
      tr: "8cm 150kg/m³ dış cephe taşyünü, yapıştırma/sıva harcı, 160gr file ve silikonlu dış cephe boyası.",
      en: "80mm 150kg/m³ facade rockwool, adhesive/render mortar, 160g mesh, and silicone exterior paint."
    },
    items: [
      {
        id: "ins_1",
        name: {
          tr: "80mm 150 kg/m³ Yoğunlukta Dış Cephe Taşyünü Levha",
          en: "80mm (150 kg/m³) Exterior Facade Rockwool Board"
        },
        qty: 8000,
        unit: {
          tr: "m²",
          en: "m²"
        }
      },
      {
        id: "ins_2",
        name: {
          tr: "Polimer Takviyeli Taşyünü Yapıştırma ve Sıva Harcı",
          en: "Polymer-Modified Rockwool Adhesive & Render Mortar"
        },
        qty: 3200,
        unit: {
          tr: "Torba",
          en: "Bags"
        }
      },
      {
        id: "ins_3",
        name: {
          tr: "160 gr/m² Alkali Dayanımlı Sıva Filesi ve Çelik Pimli Dübel",
          en: "160 gsm Alkali-Resistant Mesh & Steel-Pin Anchors"
        },
        qty: 8800,
        unit: {
          tr: "m²",
          en: "m²"
        }
      },
      {
        id: "ins_4",
        name: {
          tr: "Tam Silikonlu Grenli Dış Cephe Boyası ve Astarı (15L)",
          en: "Silicone Textured Exterior Facade Paint & Primer (15L)"
        },
        qty: 280,
        unit: {
          tr: "Kova",
          en: "Buckets"
        }
      }
    ],
    suppliers: [
      {
        id: "ins_sup1",
        name: {
          tr: "Firma A (Fabrika Peşin)",
          en: "Supplier A (Factory Cash)"
        },
        currency: "TRY",
        delivery: "factory_exw",
        transportTRY: 120000,
        craneTRY: 28000,
        wastePct: 2.5,
        vatIncluded: false,
        preset: "cash",
        prices: {
          ins_1: 310,
          ins_2: 195,
          ins_3: 42,
          ins_4: 2450
        }
      },
      {
        id: "ins_sup2",
        name: {
          tr: "Firma B (30-60-90 Çek)",
          en: "Supplier B (30-60-90D Check)"
        },
        currency: "TRY",
        delivery: "site_stacked",
        transportTRY: 0,
        craneTRY: 0,
        wastePct: 1,
        vatIncluded: false,
        preset: "30_60_90",
        prices: {
          ins_1: 345,
          ins_2: 215,
          ins_3: 46,
          ins_4: 2690
        }
      },
      {
        id: "ins_sup3",
        name: {
          tr: "Firma C (120 Gün Tek Çek)",
          en: "Supplier C (120D Single Check)"
        },
        currency: "TRY",
        delivery: "site_no_crane",
        transportTRY: 0,
        craneTRY: 25000,
        wastePct: 1.5,
        vatIncluded: false,
        preset: "single_120",
        prices: {
          ins_1: 365,
          ins_2: 225,
          ins_3: 49,
          ins_4: 2780
        }
      }
    ]
  },
  {
    id: "pkt07_steel",
    code: "PKT-07",
    category: "INFRA_STEEL",
    quick: false,
    title: {
      tr: "85 Ton Çelik Konstrüksiyon Çatı İmalatı",
      en: "85 Tons Structural Steel Roof Fabrication"
    },
    summary: {
      tr: "S275JR HEA/IPE hadde profiller, kutu profiller, SA 2.5 kumlama ve epoksi boyalı imalat.",
      en: "S275JR HEA/IPE rolled beams, hollow sections, SA 2.5 sandblasting, and epoxy primer."
    },
    items: [
      {
        id: "stl_1",
        name: {
          tr: "S275JR HEA 240 - IPE 300 Hadde Çelik Profiller",
          en: "S275JR HEA 240 - IPE 300 Rolled Steel Beams"
        },
        qty: 50,
        unit: {
          tr: "Ton",
          en: "Tons"
        }
      },
      {
        id: "stl_2",
        name: {
          tr: "S235JR 100x100x5mm Çelik Kutu Profil ve Aşıklar",
          en: "S235JR 100x100x5mm Hollow Sections & Purlins"
        },
        qty: 25,
        unit: {
          tr: "Ton",
          en: "Tons"
        }
      },
      {
        id: "stl_3",
        name: {
          tr: "Lazer Kesim Çelik Bayrak Plakası + Kumlama/Boya",
          en: "Laser-Cut Gusset Plates + SA2.5 Blast & Epoxy"
        },
        qty: 10,
        unit: {
          tr: "Ton",
          en: "Tons"
        }
      }
    ],
    suppliers: [
      {
        id: "stl_sup1",
        name: {
          tr: "Firma A (Fabrika Peşin)",
          en: "Supplier A (Factory Cash)"
        },
        currency: "TRY",
        delivery: "factory_exw",
        transportTRY: 85000,
        craneTRY: 40000,
        wastePct: 3.5,
        vatIncluded: false,
        preset: "cash",
        prices: {
          stl_1: 38500,
          stl_2: 36800,
          stl_3: 52000
        }
      },
      {
        id: "stl_sup2",
        name: {
          tr: "Firma B (30-60-90 Gün Çek)",
          en: "Supplier B (30-60-90D Check)"
        },
        currency: "TRY",
        delivery: "site_stacked",
        transportTRY: 0,
        craneTRY: 0,
        wastePct: 0,
        vatIncluded: false,
        preset: "30_60_90",
        prices: {
          stl_1: 42900,
          stl_2: 40800,
          stl_3: 56500
        }
      },
      {
        id: "stl_sup3",
        name: {
          tr: "Firma C (%30 Avans + 60G USD)",
          en: "Supplier C (30% Adv + 60D USD)"
        },
        currency: "USD",
        delivery: "site_no_crane",
        transportTRY: 0,
        craneTRY: 40000,
        wastePct: 1,
        vatIncluded: false,
        preset: "adv30_60",
        prices: {
          stl_1: 1150,
          stl_2: 1090,
          stl_3: 1520
        }
      }
    ]
  },
  {
    id: "pkt08_facade",
    code: "PKT-08",
    category: "ARCHITECTURAL",
    quick: false,
    title: {
      tr: "1.800 m² Alüminyum Doğrama ve Isıcam",
      en: "1,800 m² Aluminum Joinery & Double Glazing"
    },
    summary: {
      tr: "Isı yalıtımlı alüminyum doğrama, 6+16+6 temperli konfor ısıcam ve A2 yanmaz kompozit panel.",
      en: "Thermally broken aluminum joinery, 6+16+6 tempered solar low-e glass, and A2 composite cladding."
    },
    items: [
      {
        id: "fac_1",
        name: {
          tr: "Isı Yalıtımlı Alüminyum Doğrama ve Cephe Sistemi",
          en: "Thermally Broken Aluminum Joinery & Framing"
        },
        qty: 1800,
        unit: {
          tr: "m²",
          en: "m²"
        }
      },
      {
        id: "fac_2",
        name: {
          tr: "6mm Temperli Konfor + 16 Argon + 6mm Isıcam",
          en: "6mm Tempered Solar Low-E + 16Ar + 6mm Double Glazing"
        },
        qty: 1800,
        unit: {
          tr: "m²",
          en: "m²"
        }
      },
      {
        id: "fac_3",
        name: {
          tr: "A2 Sınıfı Yanmaz Alüminyum Kompozit Cephe Kaplama",
          en: "A2 Fire-Rated Aluminum Composite Cladding"
        },
        qty: 850,
        unit: {
          tr: "m²",
          en: "m²"
        }
      }
    ],
    suppliers: [
      {
        id: "fac_sup1",
        name: {
          tr: "Firma A (Fabrika Peşin)",
          en: "Supplier A (Factory Cash)"
        },
        currency: "TRY",
        delivery: "factory_exw",
        transportTRY: 160000,
        craneTRY: 65000,
        wastePct: 2,
        vatIncluded: false,
        preset: "cash",
        prices: {
          fac_1: 3850,
          fac_2: 1950,
          fac_3: 2750
        }
      },
      {
        id: "fac_sup2",
        name: {
          tr: "Firma B (%20 Avans + 45/90G Çek)",
          en: "Supplier B (20% Adv + 45/90D)"
        },
        currency: "TRY",
        delivery: "site_stacked",
        transportTRY: 0,
        craneTRY: 0,
        wastePct: 0,
        vatIncluded: false,
        preset: "adv20_45_90",
        prices: {
          fac_1: 4250,
          fac_2: 2120,
          fac_3: 3020
        }
      },
      {
        id: "fac_sup3",
        name: {
          tr: "Firma C (%30 Avans + 60G EUR)",
          en: "Supplier C (30% Adv + 60D EUR)"
        },
        currency: "EUR",
        delivery: "site_stacked",
        transportTRY: 0,
        craneTRY: 0,
        wastePct: 0,
        vatIncluded: false,
        preset: "adv30_60",
        prices: {
          fac_1: 107,
          fac_2: 53.5,
          fac_3: 76
        }
      }
    ]
  },
  {
    id: "pkt09_formwork",
    code: "PKT-09",
    category: "STRUCTURAL",
    quick: false,
    title: {
      tr: "1.200 Adet Plywood ve H20 Kalıp Kirişi",
      en: "1,200 Pcs Film-Faced Plywood & H20 Beams"
    },
    summary: {
      tr: "18mm 1250x2500 huş filmli plywood, H20 ahşap kalıp kirişi ve teleskopik çelik dikme.",
      en: "18mm 1250x2500 birch film-faced plywood, H20 timber formwork beams, and telescopic steel props."
    },
    items: [
      {
        id: "frm_1",
        name: {
          tr: "18mm 1250x2500mm 13 Kat Huş Filmli Plywood",
          en: "18mm 1250x2500mm 13-Ply Birch Film-Faced Plywood"
        },
        qty: 1200,
        unit: {
          tr: "Adet",
          en: "Sheets"
        }
      },
      {
        id: "frm_2",
        name: {
          tr: "H20 Ahşap Kalıp Kirişi (Uç Korumalı, L=3.90m)",
          en: "H20 Timber Formwork Beam (Cap Protected, L=3.90m)"
        },
        qty: 6500,
        unit: {
          tr: "mt",
          en: "m"
        }
      },
      {
        id: "frm_3",
        name: {
          tr: "Ağır Hizmet Teleskopik Çelik Dikme (4.00m Galvaniz)",
          en: "Heavy-Duty Telescopic Steel Prop (4.00m Galvanized)"
        },
        qty: 1500,
        unit: {
          tr: "Adet",
          en: "Pcs"
        }
      }
    ],
    suppliers: [
      {
        id: "frm_sup1",
        name: {
          tr: "Firma A (Fabrika Peşin)",
          en: "Supplier A (Factory Cash)"
        },
        currency: "TRY",
        delivery: "factory_exw",
        transportTRY: 98000,
        craneTRY: 24000,
        wastePct: 1.5,
        vatIncluded: false,
        preset: "cash",
        prices: {
          frm_1: 1980,
          frm_2: 245,
          frm_3: 920
        }
      },
      {
        id: "frm_sup2",
        name: {
          tr: "Firma B (30-60-90 Çek)",
          en: "Supplier B (30-60-90D Check)"
        },
        currency: "TRY",
        delivery: "site_stacked",
        transportTRY: 0,
        craneTRY: 0,
        wastePct: 0,
        vatIncluded: false,
        preset: "30_60_90",
        prices: {
          frm_1: 2190,
          frm_2: 272,
          frm_3: 1020
        }
      },
      {
        id: "frm_sup3",
        name: {
          tr: "Firma C (%30 Avans + 60G USD)",
          en: "Supplier C (30% Adv + 60D USD)"
        },
        currency: "USD",
        delivery: "site_no_crane",
        transportTRY: 0,
        craneTRY: 22000,
        wastePct: 0,
        vatIncluded: false,
        preset: "adv30_60",
        prices: {
          frm_1: 58.5,
          frm_2: 7.2,
          frm_3: 27.5
        }
      }
    ]
  },
  {
    id: "pkt10_infra",
    code: "PKT-10",
    category: "INFRA_STEEL",
    quick: false,
    title: {
      tr: "Altyapı Koruge Boru ve Muayene Bacası",
      en: "HDPE Corrugated Pipe & Manhole Package"
    },
    summary: {
      tr: "SN8 Ø400-Ø600 HDPE koruge altyapı borusu, prefabrik beton muayene bacası ve D400 sfero döküm kapak.",
      en: "SN8 Ø400-Ø600 HDPE corrugated pipe, precast concrete manholes, and D400 ductile iron covers."
    },
    items: [
      {
        id: "inf_1",
        name: {
          tr: "Ø400 SN8 Contalı HDPE Koruge Kanalizasyon Borusu",
          en: "Ø400 SN8 Gasketed HDPE Corrugated Sewer Pipe"
        },
        qty: 2200,
        unit: {
          tr: "mt",
          en: "m"
        }
      },
      {
        id: "inf_2",
        name: {
          tr: "Ø600 SN8 Contalı HDPE Koruge Yağmursuyu Borusu",
          en: "Ø600 SN8 Gasketed HDPE Corrugated Stormwater Pipe"
        },
        qty: 1400,
        unit: {
          tr: "mt",
          en: "m"
        }
      },
      {
        id: "inf_3",
        name: {
          tr: "Ø1000 Prefabrik Betonarme Muayene Bacası Seti",
          en: "Ø1000 Precast Concrete Manhole Assembly"
        },
        qty: 65,
        unit: {
          tr: "Takım",
          en: "Sets"
        }
      },
      {
        id: "inf_4",
        name: {
          tr: "Ø600 D400 Ağır Yük Sınıfı Sfero Döküm Baca Kapağı",
          en: "Ø600 D400 Heavy-Duty Ductile Iron Manhole Cover"
        },
        qty: 65,
        unit: {
          tr: "Adet",
          en: "Pcs"
        }
      }
    ],
    suppliers: [
      {
        id: "inf_sup1",
        name: {
          tr: "Firma A (Fabrika Peşin)",
          en: "Supplier A (Factory Cash)"
        },
        currency: "TRY",
        delivery: "factory_exw",
        transportTRY: 165000,
        craneTRY: 42000,
        wastePct: 1.5,
        vatIncluded: false,
        preset: "cash",
        prices: {
          inf_1: 640,
          inf_2: 1290,
          inf_3: 11500,
          inf_4: 3850
        }
      },
      {
        id: "inf_sup2",
        name: {
          tr: "Firma B (30-60-90 Gün Çek)",
          en: "Supplier B (30-60-90D Check)"
        },
        currency: "TRY",
        delivery: "site_stacked",
        transportTRY: 0,
        craneTRY: 0,
        wastePct: 0,
        vatIncluded: false,
        preset: "30_60_90",
        prices: {
          inf_1: 715,
          inf_2: 1430,
          inf_3: 12800,
          inf_4: 4250
        }
      },
      {
        id: "inf_sup3",
        name: {
          tr: "Firma C (90 Gün Tek Çek)",
          en: "Supplier C (90D Single Check)"
        },
        currency: "TRY",
        delivery: "site_no_crane",
        transportTRY: 0,
        craneTRY: 42000,
        wastePct: 1,
        vatIncluded: false,
        preset: "single_90",
        prices: {
          inf_1: 735,
          inf_2: 1460,
          inf_3: 12900,
          inf_4: 4100
        }
      }
    ]
  }
];
});
