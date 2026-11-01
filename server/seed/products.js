/**
 * Starter inventory for Voltyard Motors.
 * Specs are approximate public figures for each trim (km and km/h).
 * Prices are this fictional dealer's asking prices in Philippine pesos.
 */
const ALL = ['Model 3', 'Model Y', 'Model S', 'Model X', 'Cybertruck'];

module.exports = [
  // ---------- Model 3 ----------
  {
    name: '2024 Model 3 Long Range AWD', model: 'Model 3', year: 2024, trim: 'Long Range AWD',
    stockNumber: 'VY-0301', condition: 'new', color: 'Ultra Red', price: 2890000, featured: true,
    image: 'assets/img/cars/model3-highland-lr.jpg',
    summary: 'The refreshed Model 3 with ventilated seats, rear screen and quieter cabin.',
    description: 'Factory-new 2024 Model 3 in Ultra Red. This is the refreshed body with slimmer headlights, acoustic glass all round, and an 8-inch rear touchscreen for passengers. Dual motors give all-weather grip, and the Long Range pack covers a Manila–Baguio run with charge to spare.',
    features: ['Ventilated front seats', '8" rear touchscreen', 'Acoustic glass', 'Premium audio, 17 speakers', 'Glass roof'],
    specs: { rangeKm: 629, zeroTo100: 4.4, topSpeedKph: 201, batteryKwh: 75, drive: 'AWD', seats: 5, odometerKm: 12, batteryHealth: 100 },
  },
  {
    name: '2024 Model 3 Performance', model: 'Model 3', year: 2024, trim: 'Performance AWD',
    stockNumber: 'VY-0302', condition: 'new', color: 'Pearl White', price: 3490000,
    image: 'assets/img/cars/model3-highland-perf.jpg',
    summary: 'Adaptive suspension, sport seats and 0–100 in 3.1 seconds.',
    description: 'The quickest Model 3 yet. Adaptive dampers, bolstered front seats, a carbon rear spoiler and 20-inch Warp wheels. Track Mode is enabled for days at Clark International Speedway.',
    features: ['Adaptive damping', 'Sport front seats', '20" Warp wheels', 'Track Mode', 'Carbon fibre spoiler'],
    specs: { rangeKm: 528, zeroTo100: 3.1, topSpeedKph: 262, batteryKwh: 79, drive: 'AWD', seats: 5, odometerKm: 8, batteryHealth: 100 },
  },
  {
    name: '2024 Model 3 Rear-Wheel Drive', model: 'Model 3', year: 2024, trim: 'RWD',
    stockNumber: 'VY-0218', condition: 'pre-owned', color: 'Diamond Black', price: 2150000,
    image: 'assets/img/cars/model3-highland-black.jpg',
    summary: 'One owner, 14,200 km, balance of factory warranty.',
    description: 'One-owner refreshed Model 3 RWD, serviced at 10,000 km. LFP battery, so daily charging to 100% is fine. Comes with both key cards and the original mobile connector.',
    features: ['LFP battery (charge to 100% daily)', 'Remaining factory warranty', 'Two key cards', 'Mobile connector included'],
    specs: { rangeKm: 513, zeroTo100: 6.1, topSpeedKph: 201, batteryKwh: 60, drive: 'RWD', seats: 5, odometerKm: 14200, batteryHealth: 97 },
  },

  // ---------- Model Y ----------
  {
    name: '2025 Model Y Long Range Launch Series', model: 'Model Y', year: 2025, trim: 'Long Range AWD Launch Series',
    stockNumber: 'VY-0405', condition: 'new', color: 'Quicksilver', price: 3190000, featured: true,
    image: 'assets/img/cars/modely-juniper.jpg',
    summary: 'The redesigned Model Y with light-bar front and powered second row.',
    description: 'Launch Series of the redesigned Model Y in Quicksilver. Full-width light bar, ventilated seats, powered folding rear seats and an 8-inch rear display. The cabin is noticeably quieter than the outgoing model.',
    features: ['Full-width front light bar', 'Ventilated front seats', 'Powered folding rear seats', 'Ambient lighting', 'Launch Series badging'],
    specs: { rangeKm: 568, zeroTo100: 4.3, topSpeedKph: 201, batteryKwh: 75, drive: 'AWD', seats: 5, odometerKm: 40, batteryHealth: 100 },
  },
  {
    name: '2022 Model Y Long Range', model: 'Model Y', year: 2022, trim: 'Long Range AWD',
    stockNumber: 'VY-0233', condition: 'pre-owned', color: 'Pearl White', price: 2250000,
    image: 'assets/img/cars/modely-white.jpg',
    summary: 'Family-sized, 38,500 km, new tyres fitted this year.',
    description: 'Well-kept Model Y Long Range with a white interior that has been ceramic-coated. Four new Michelin Pilot Sport EV tyres fitted in March. Tow hitch installed.',
    features: ['New tyres (2026)', 'Tow hitch', 'White interior, ceramic coated', 'Heated seats front and rear'],
    specs: { rangeKm: 533, zeroTo100: 5.0, topSpeedKph: 217, batteryKwh: 75, drive: 'AWD', seats: 5, odometerKm: 38500, batteryHealth: 93 },
  },
  {
    name: '2021 Model Y Performance', model: 'Model Y', year: 2021, trim: 'Performance AWD',
    stockNumber: 'VY-0247', condition: 'pre-owned', color: 'Midnight Silver Metallic', price: 2390000,
    image: 'assets/img/cars/modely-grey.jpg',
    summary: '21" Überturbine wheels, lowered suspension, 52,100 km.',
    description: 'Model Y Performance on the factory 21-inch Überturbine wheels. Battery health tested at 91% at our service bay. Paint protection film on the front clip.',
    features: ['21" Überturbine wheels', 'Lowered suspension', 'Front PPF', 'Performance brakes'],
    specs: { rangeKm: 514, zeroTo100: 3.7, topSpeedKph: 241, batteryKwh: 75, drive: 'AWD', seats: 5, odometerKm: 52100, batteryHealth: 91 },
  },

  // ---------- Model S ----------
  {
    name: '2023 Model S Plaid', model: 'Model S', year: 2023, trim: 'Plaid',
    stockNumber: 'VY-0512', condition: 'pre-owned', color: 'Deep Blue Metallic', price: 5450000, featured: true,
    image: 'assets/img/cars/models-plaid.jpg',
    summary: 'Three motors, 1,020 hp, under 10,000 km.',
    description: 'Tri-motor Model S Plaid with the yoke and a round wheel included. Under 10,000 km and garage-kept. 21-inch Arachnid wheels with red calipers.',
    features: ['Tri-motor, 1,020 hp', 'Yoke + round steering wheel', '21" Arachnid wheels', 'Rear-seat screen', 'Gaming-grade computer'],
    specs: { rangeKm: 600, zeroTo100: 2.1, topSpeedKph: 282, batteryKwh: 100, drive: 'AWD', seats: 5, odometerKm: 9800, batteryHealth: 98 },
  },
  {
    name: '2021 Model S Long Range', model: 'Model S', year: 2021, trim: 'Long Range',
    stockNumber: 'VY-0508', condition: 'pre-owned', color: 'Pearl White', price: 3650000,
    image: 'assets/img/cars/models-2021-lr.jpg',
    summary: 'The longest-range car on our lot, 634 km rated.',
    description: 'Refreshed-interior Model S Long Range with the horizontal centre screen. 41,000 km, full service history, and battery health of 92%.',
    features: ['634 km rated range', 'Horizontal 17" display', 'HEPA filter', 'Free lifetime connectivity (transferred)'],
    specs: { rangeKm: 634, zeroTo100: 3.2, topSpeedKph: 250, batteryKwh: 100, drive: 'AWD', seats: 5, odometerKm: 41000, batteryHealth: 92 },
  },
  {
    name: '2015 Model S 70D', model: 'Model S', year: 2015, trim: '70D',
    stockNumber: 'VY-0115', condition: 'pre-owned', color: 'Midnight Blue Metallic', price: 1350000,
    image: 'assets/img/cars/models-2015-70d.jpg',
    summary: 'The entry ticket to Tesla ownership. Inspected and priced to move.',
    description: 'A classic nose-cone Model S with dual motors. 148,000 km, with drive units and half-shafts replaced under warranty in 2020. Battery health 84%: enough for a city commute with fast charging on longer trips.',
    features: ['Dual motor AWD', 'Drive units replaced (2020)', 'Air suspension', 'Panoramic roof'],
    specs: { rangeKm: 386, zeroTo100: 5.4, topSpeedKph: 225, batteryKwh: 70, drive: 'AWD', seats: 5, odometerKm: 148000, batteryHealth: 84 },
  },

  // ---------- Model X ----------
  {
    name: '2018 Model X 100D', model: 'Model X', year: 2018, trim: '100D',
    stockNumber: 'VY-0620', condition: 'pre-owned', color: 'Solid Black', price: 2950000,
    image: 'assets/img/cars/modelx-black.jpg',
    summary: 'Seven seats and falcon-wing doors for school runs.',
    description: 'Seven-seat Model X 100D with falcon-wing doors that open in tight parking spaces. 86,000 km and recently serviced: new 12V battery and cabin filters.',
    features: ['7 seats', 'Falcon-wing doors', 'Tow package', 'New 12V battery (2026)'],
    specs: { rangeKm: 475, zeroTo100: 4.9, topSpeedKph: 250, batteryKwh: 100, drive: 'AWD', seats: 7, odometerKm: 86000, batteryHealth: 88 },
  },
  {
    name: '2019 Model X Performance', model: 'Model X', year: 2019, trim: 'Performance Ludicrous',
    stockNumber: 'VY-0624', condition: 'pre-owned', color: 'Midnight Silver Metallic', price: 3390000,
    image: 'assets/img/cars/modelx-2019-perf.jpg',
    summary: 'Ludicrous mode SUV with six captain seats.',
    description: 'Model X Performance with Ludicrous mode and the six-seat captain chair layout. 61,000 km, single owner from Alabang.',
    features: ['Ludicrous mode', '6-seat captain chairs', 'Smart air suspension', '22" Turbine wheels'],
    specs: { rangeKm: 465, zeroTo100: 2.8, topSpeedKph: 250, batteryKwh: 100, drive: 'AWD', seats: 6, odometerKm: 61000, batteryHealth: 90 },
  },

  // ---------- Cybertruck ----------
  {
    name: '2024 Cybertruck Foundation Series', model: 'Cybertruck', year: 2024, trim: 'Foundation Series AWD',
    stockNumber: 'VY-0701', condition: 'pre-owned', color: 'Stainless Steel', price: 6800000, featured: true,
    image: 'assets/img/cars/cybertruck-foundation.jpg',
    summary: 'Privately imported, 3,200 km, stainless exoskeleton.',
    description: 'One of the few Cybertrucks in the country. Foundation Series with powered tonneau, 120V and 240V outlets in the bed, and steer-by-wire with rear-wheel steering. Import duties are already paid and the truck is LTO-registered.',
    features: ['Rear-wheel steering', 'Powered tonneau cover', '240V bed outlet', 'Adaptive air suspension', 'LTO registered'],
    specs: { rangeKm: 547, zeroTo100: 4.3, topSpeedKph: 180, batteryKwh: 123, drive: 'AWD', seats: 5, odometerKm: 3200, batteryHealth: 99 },
  },

  // ---------- Roadster ----------
  {
    name: '2008 Roadster', model: 'Roadster', year: 2008, trim: 'Signature',
    stockNumber: 'VY-0008', condition: 'pre-owned', color: 'Steel Grey', price: 4200000,
    image: 'assets/img/cars/roadster-2008.jpg',
    summary: "Tesla's first car. A collector's piece built on a Lotus chassis.",
    description: 'An original 2008 Roadster, the car that started Tesla. Lotus Elise-derived chassis, hand-laid carbon body panels, and a single-speed gearbox. Battery health 78%. Sold as a collector vehicle.',
    features: ['Collector vehicle', 'Carbon fibre body panels', 'Removable soft top', 'Original owner manual'],
    specs: { rangeKm: 393, zeroTo100: 4.0, topSpeedKph: 201, batteryKwh: 53, drive: 'RWD', seats: 2, odometerKm: 61400, batteryHealth: 78 },
  },

  // ---------- Accessories ----------
  {
    name: 'Wall Connector (Gen 3)', category: 'accessory', compatibleWith: ALL, price: 38500, stock: 12,
    image: 'assets/img/acc/wall-connector.jpg',
    summary: 'Home charging up to 11.5 kW. Installation booked separately.',
    description: 'The fastest way to charge at home. Wi-Fi connected for firmware updates and power sharing between two units. Comes with a 7.3 m cable.',
    features: ['Up to 11.5 kW', '7.3 m cable', 'Wi-Fi updates', 'Indoor and outdoor rated'],
  },
  {
    name: 'Destination Charger, Commercial Pair', category: 'accessory', compatibleWith: ALL, price: 92000, stock: 3,
    image: 'assets/img/acc/destination-charger.jpg',
    summary: 'Two pedestals for hotels, offices and condo parking.',
    description: 'A pair of destination chargers for businesses that want guests to charge while they stay. Price covers both units; our electrician quotes the installation on site.',
    features: ['Two charging units', 'Load sharing', 'Site survey included'],
  },
  {
    name: 'Model 3 18" Aero Wheel Set', category: 'accessory', compatibleWith: ['Model 3'], price: 118000, stock: 4,
    image: 'assets/img/acc/model3-aero-wheel.jpg',
    summary: 'Four wheels with aero caps and all-season tyres. Adds range.',
    description: 'Factory 18-inch Aero wheels with caps and mounted all-season tyres. Swapping from 19-inch or 20-inch wheels adds roughly 5–8% range.',
    features: ['Set of 4', 'Tyres mounted and balanced', 'Aero caps included'],
  },
  {
    name: 'Cybertruck 20" All-Terrain Wheel & Tyre', category: 'accessory', compatibleWith: ['Cybertruck'], price: 165000, stock: 2,
    image: 'assets/img/acc/cybertruck-wheel.jpg',
    summary: 'Goodyear Wrangler Territory tyres on factory 20" wheels.',
    description: 'Set of four 20-inch Cybertruck wheels on Goodyear Wrangler Territory all-terrain tyres. Removed from a new truck at 200 km.',
    features: ['Set of 4', 'Goodyear Wrangler Territory', '200 km take-offs'],
  },
  {
    name: 'Model S 21" Wheel & Tyre (single)', category: 'accessory', compatibleWith: ['Model S'], price: 28000, stock: 3,
    image: 'assets/img/acc/models-wheel.jpg',
    summary: 'Single replacement wheel for P100D-era Model S.',
    description: 'A single 21-inch wheel with mounted performance tyre, for replacing a curbed or damaged wheel on 2016–2020 Model S.',
    features: ['Single wheel', 'Tyre mounted', 'Fits 2016–2020 Model S'],
  },
].map((p) => ({ category: 'vehicle', ...p }));
