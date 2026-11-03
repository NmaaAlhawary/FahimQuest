// Cube Island story challenges: one per island, played inside the 3D world.
// Grid: x goes right (0 = left), y goes up/away (0 = the row nearest the crystal).
// start: [x, y, facing]  facing: E N W S
// items: things Fahim can pick up.  pads: where things must end up (accepts = item kind or colour).
// goal 'deliver' = every item on a pad that accepts it. goal 'lamps' = a crystal placed on every lamp pad.
// trials: the same program runs once per trial (used to force IF).

const WORLD_TASKS = [
  {
    c: 'pos', icon: '🏴‍☠️', w: 7, h: 5, start: [0, 0, 'E'], coords: true,
    items: [{ x: 2, y: 3, kind: 'chest' }],
    pads: [{ x: 6, y: 1, icon: '🚤', color: '#0EA5A4', accepts: 'chest' }],
    blocks: ['goto', 'pick', 'drop'], optimal: 4,
    title: { en: 'Pirate Treasure', ar: 'كنز القراصنة' },
    story: {
      en: "A storm washed Captain Coral's treasure chest onto the beach! Her boat 🚤 is waiting to take it home. Every square has an address (x, y). Use “go to” to walk to the chest, pick it up, and carry it to the boat.",
      ar: 'رمت العاصفة صندوق كنز القبطانة مرجان على الشاطئ! قاربها 🚤 ينتظر ليعيده إلى البيت. لكل مربع عنوان (س، ص). استخدم «اذهب إلى» لتمشي إلى الصندوق، ثم التقطه واحمله إلى القارب.',
    },
    goal: { en: 'Bring the chest to the boat 🚤 at (6, 1).', ar: 'أوصل الصندوق إلى القارب 🚤 عند (6، 1).' },
    hint: { en: 'go to (2, 3) → pick up → go to (6, 1) → put down', ar: 'اذهب إلى (2، 3) ← التقط ← اذهب إلى (6، 1) ← ضع' },
  },
  {
    c: 'seq', icon: '🍊', w: 5, h: 3, start: [0, 0, 'E'],
    items: [{ x: 2, y: 0, kind: 'crate' }],
    pads: [{ x: 2, y: 2, icon: '🍊', color: '#F26A1B', accepts: 'crate' }],
    walls: [{ x: 4, y: 0, t: 'leaves' }, { x: 0, y: 2, t: 'leaves' }],
    blocks: ['move', 'turnL', 'turnR', 'pick', 'drop'], optimal: 7,
    title: { en: 'Orange Delivery', ar: 'توصيل البرتقال' },
    story: {
      en: 'The market stall 🍊 ran out of oranges and the customers are waiting! Drive Fahim to the orange crate, pick it up, and deliver it to the stall. The order of your steps matters!',
      ar: 'نفد البرتقال من بسطة السوق 🍊 والزبائن ينتظرون! قُد فهيم إلى صندوق البرتقال، التقطه، وأوصله إلى البسطة. ترتيب خطواتك مهم!',
    },
    goal: { en: 'Deliver the orange crate to the stall 🍊.', ar: 'أوصل صندوق البرتقال إلى البسطة 🍊.' },
    hint: { en: 'move, move, pick up, turn left, move, move, put down', ar: 'تقدّم، تقدّم، التقط، استدر يسارًا، تقدّم، تقدّم، ضع' },
  },
  {
    c: 'loop', icon: '🐪', w: 9, h: 3, start: [0, 1, 'E'],
    items: [{ x: 0, y: 1, kind: 'bucket' }],
    pads: [{ x: 8, y: 1, icon: '🐪', color: '#3B82F6', accepts: 'bucket' }],
    walls: [{ x: 3, y: 0, t: 'cactus' }, { x: 6, y: 2, t: 'cactus' }, { x: 1, y: 2, t: 'cactus' }],
    blocks: ['move', 'turnL', 'turnR', 'pick', 'drop', 'repeat'], limit: 4, optimal: 4,
    title: { en: 'Thirsty Camels', ar: 'الجمال العطشى' },
    story: {
      en: 'The camels 🐪 are thirsty! Carry the water bucket to the trough at the end of the desert road, 8 steps away. You only have 4 blocks, so use a repeat loop to walk many steps with one block!',
      ar: 'الجمال 🐪 عطشى! احمل دلو الماء إلى الحوض في آخر طريق الصحراء، على بعد 8 خطوات. معك 4 أوامر فقط، فاستخدم حلقة «كرّر» لتمشي خطوات كثيرة بأمر واحد!',
    },
    goal: { en: 'Bring the water to the camels 🐪 using 4 blocks or fewer.', ar: 'أوصل الماء إلى الجمال 🐪 بأربعة أوامر أو أقل.' },
    hint: { en: 'pick up → repeat 8 times [ move ] → put down', ar: 'التقط ← كرّر 8 مرات [ تقدّم ] ← ضع' },
  },
  {
    c: 'var', icon: '⛄', w: 5, h: 5, start: [0, 0, 'E'],
    items: [{ x: 0, y: 0, kind: 'snow' }],
    pads: [{ x: 3, y: 3, icon: '⛄', color: '#60A5FA', accepts: 'snow' }],
    walls: [{ x: 1, y: 2, t: 'snow' }, { x: 0, y: 4, t: 'snow' }],
    blocks: ['move', 'turnL', 'turnR', 'pick', 'drop', 'set', 'moveVar'], optimal: 6,
    starter: [{ type: 'pick' }, { type: 'set', n: 1 }, { type: 'moveVar' }, { type: 'turnL' }, { type: 'moveVar' }, { type: 'drop' }],
    title: { en: 'Snowman Builder', ar: 'باني رجل الثلج' },
    story: {
      en: 'The snow kids are building a snowman ⛄ and need one more snowball! On the ice, Fahim slides as many squares as the number in the “steps” box. The program is ready: just change the number in the box so Fahim lands on the snowman.',
      ar: 'أطفال الثلج يبنون رجل ثلج ⛄ ويحتاجون كرة ثلج أخيرة! على الجليد ينزلق فهيم بعدد المربعات المكتوب في صندوق «الخطوات». البرنامج جاهز: غيّر الرقم في الصندوق فقط ليصل فهيم إلى رجل الثلج.',
    },
    goal: { en: 'Change the number in the steps box to deliver the snowball ⛄.', ar: 'غيّر الرقم في صندوق الخطوات لتوصل كرة الثلج ⛄.' },
    hint: { en: 'Count the squares to the snowman: how many across? How many up? It is the same number!', ar: 'عُدّ المربعات إلى رجل الثلج: كم بالعرض؟ كم للأعلى؟ إنه الرقم نفسه!' },
  },
  {
    c: 'cond', icon: '💎', w: 5, h: 3, start: [2, 0, 'N'],
    items: [{ x: 2, y: 1, kind: 'gembox', color: 'red' }],
    pads: [{ x: 0, y: 1, icon: '🟥', color: '#DC2626', accepts: 'red' }, { x: 4, y: 1, icon: '🟦', color: '#2563EB', accepts: 'blue' }],
    trials: ['red', 'blue', 'red'],
    blocks: ['move', 'turnL', 'turnR', 'pick', 'drop', 'repeat', 'if'], optimal: 8,
    title: { en: 'Gem Sorter', ar: 'فرز الجواهر' },
    story: {
      en: "Deep in the mine, the cart drops a box of gems 📦. Sometimes it's red, sometimes blue! Red boxes go on the red pad, blue boxes on the blue pad. Fahim will sort 3 boxes, and ONE program must work for all of them. Use IF to decide!",
      ar: 'في عمق المنجم تُسقط العربة صندوق جواهر 📦، أحيانًا أحمر وأحيانًا أزرق! الصناديق الحمراء على المنصة الحمراء، والزرقاء على المنصة الزرقاء. سيفرز فهيم 3 صناديق، وبرنامج واحد يجب أن ينجح معها كلها. استخدم «إذا» لتقرّر!',
    },
    goal: { en: 'Sort all 3 boxes onto the pad of the same colour.', ar: 'افرز الصناديق الثلاثة على المنصة التي لها اللون نفسه.' },
    hint: { en: 'move, pick up, if box is red: turn left, else: turn right. Then move, move, put down.', ar: 'تقدّم، التقط، إذا كان الصندوق أحمر: استدر يسارًا، وإلا: استدر يمينًا. ثم تقدّم، تقدّم، ضع.' },
  },
  {
    c: 'fn', icon: '🏮', w: 7, h: 2, start: [0, 0, 'E'], goal_type: 'lamps',
    items: [],
    pads: [1, 3, 5].map((x) => ({ x, y: 1, icon: '🏮', color: '#A855F7', lamp: true })),
    blocks: ['move', 'turnL', 'turnR', 'place', 'repeat', 'call'], limit: 9, optimal: 8, mustUse: 'call',
    title: { en: 'Light the Forest', ar: 'أضئ الغابة' },
    story: {
      en: 'The magic forest is dark at night! Put a glowing crystal 💎 on each of the 3 lamp spots 🏮. Every lamp needs the same steps, so teach Fahim a new command: build my_move() once, then use it again and again!',
      ar: 'الغابة السحرية مظلمة في الليل! ضع بلّورة مضيئة 💎 على كل مكان من أماكن المصابيح الثلاثة 🏮. كل مصباح يحتاج الخطوات نفسها، فعلّم فهيم أمرًا جديدًا: ابنِ حركتي() مرة واحدة، ثم استخدمها مرات ومرات!',
    },
    goal: { en: 'Light all 3 lamps 🏮 using my_move() and 9 blocks or fewer.', ar: 'أضئ المصابيح الثلاثة 🏮 باستخدام حركتي() وبتسعة أوامر أو أقل.' },
    hint: { en: 'my_move = move, turn left, place crystal, turn right, move. Program: my_move, my_move, my_move.', ar: 'حركتي = تقدّم، استدر يسارًا، ضع بلّورة، استدر يمينًا، تقدّم. البرنامج: حركتي، حركتي، حركتي.' },
  },
];
