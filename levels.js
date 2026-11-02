// Concepts and levels.
// Map legend (top row = highest y):  .  empty   #  wall   *  star   ~  water   G  flag   S  Fahim's start
// Fahim always starts facing east (→).

const CONCEPTS = [
  {
    id: 'pos', icon: '📍', color: '#0EA5A4',
    name: { en: 'Positions', ar: 'المواقع' },
    what: {
      en: 'Every square on the map has an address made of two numbers: x (how far across →) and y (how far up ↑). Games, robots and maps all use these numbers to know where things are.',
      ar: 'لكل مربع على الخريطة عنوان من رقمين: س (كم يبعد بالعرض →) و ص (كم يرتفع للأعلى ↑). الألعاب والروبوتات والخرائط تستخدم هذه الأرقام لتعرف مكان كل شيء.',
    },
    life: { en: 'Like your seat at the cinema: row number and seat number.', ar: 'مثل مقعدك في السينما: رقم الصف ورقم المقعد.' },
    code: 'go_to(2, 3)   # x = 2, y = 3',
    tip: {
      en: 'Tape a 5×5 grid on the floor and number the edges. One kid calls out (x, y) and another walks there. Then play "Battleship" in pairs on paper.',
      ar: 'ارسم شبكة 5×5 على الأرض بشريط لاصق ورقّم أطرافها. طالب ينادي (س، ص) وآخر يمشي إليها. ثم العبوا «معركة السفن» على الورق في أزواج.',
    },
  },
  {
    id: 'seq', icon: '🧭', color: '#2563EB',
    name: { en: 'Sequences', ar: 'التسلسل' },
    what: {
      en: 'A program is a list of steps that the computer follows one by one, in order. If you change the order, you change what happens.',
      ar: 'البرنامج قائمة خطوات ينفّذها الحاسوب واحدة تلو الأخرى بالترتيب. إذا غيّرت الترتيب تتغيّر النتيجة.',
    },
    life: { en: 'Like a recipe: you crack the egg before you fry it!', ar: 'مثل وصفة الطبخ: تكسر البيضة قبل أن تقليها!' },
    code: 'move()\nmove()\nturn_left()\nmove()',
    tip: {
      en: 'One kid is the "robot" and only follows arrow cards. The class lays out the cards to guide the robot to a chair. Swap two cards and watch it go wrong!',
      ar: 'طالب يمثّل «الروبوت» ولا يتبع إلا بطاقات الأسهم. يرتّب الصف البطاقات ليوصلوا الروبوت إلى كرسي. بدّلوا بطاقتين وشاهدوا الخطأ!',
    },
  },
  {
    id: 'loop', icon: '🔁', color: '#F26A1B',
    name: { en: 'Loops', ar: 'الحلقات (التكرار)' },
    what: {
      en: 'A loop repeats the blocks inside it as many times as you choose. Instead of writing "move" 7 times, you write it once inside a loop.',
      ar: 'الحلقة تعيد الأوامر التي بداخلها عدد المرات الذي تختاره. بدل أن تكتب «تقدّم» ٧ مرات، تكتبها مرة واحدة داخل حلقة.',
    },
    life: { en: 'Like doing 10 jumping jacks: you learn one jump, then repeat it 10 times.', ar: 'مثل ١٠ قفزات رياضية: تتعلّم القفزة مرة ثم تكرّرها ١٠ مرات.' },
    code: 'for i in range(7):\n    move()',
    tip: {
      en: 'Say "clap, stomp, clap, stomp, clap, stomp". Then say "repeat 3 times: clap, stomp". Ask which one was shorter to say.',
      ar: 'قل «صفّق، اضرب بقدمك، صفّق، اضرب بقدمك، صفّق، اضرب بقدمك». ثم قل «كرّر ٣ مرات: صفّق، اضرب بقدمك». اسألهم أيهما أقصر.',
    },
  },
  {
    id: 'var', icon: '📦', color: '#DC2626',
    name: { en: 'Variables', ar: 'المتغيّرات' },
    what: {
      en: 'A variable is a box with a name that holds a value. The program can read the box, and change what is inside it while it runs.',
      ar: 'المتغيّر صندوق له اسم ويحمل قيمة. يستطيع البرنامج أن يقرأ ما في الصندوق وأن يغيّره أثناء التشغيل.',
    },
    life: { en: 'Like the score in a game: it starts at 0 and changes every time you win a point.', ar: 'مثل النتيجة في لعبة: تبدأ من ٠ وتتغيّر كلما ربحت نقطة.' },
    code: 'steps = 3\nmove(steps)\nsteps = steps + 1',
    tip: {
      en: 'Label a shoebox "steps" and put a number card inside. Kids walk as many steps as the box says. Then swap the card and they walk again.',
      ar: 'اكتب على علبة أحذية «الخطوات» وضع بداخلها بطاقة رقم. يمشي الطلاب بعدد الخطوات المكتوب. بدّل البطاقة وكرّروا.',
    },
  },
  {
    id: 'cond', icon: '🚦', color: '#CA8A04',
    name: { en: 'Conditions', ar: 'الشروط' },
    what: {
      en: 'A condition lets the program decide. IF something is true, do one thing, ELSE do something else. That way one program can handle many different roads!',
      ar: 'الشرط يجعل البرنامج يقرّر: إذا كان الشيء صحيحًا افعل أمرًا، وإلا افعل أمرًا آخر. بهذا يستطيع برنامج واحد أن يتعامل مع طرق كثيرة مختلفة!',
    },
    life: { en: 'IF it is raining, take an umbrella. ELSE take sunglasses.', ar: 'إذا كانت تمطر خذ مظلة، وإلا خذ نظارة شمسية.' },
    code: 'if water_ahead():\n    jump()\nelse:\n    move()',
    tip: {
      en: 'Play "Traffic Light": IF the card is red, freeze, ELSE walk. Then add a third rule for yellow.',
      ar: 'العبوا «إشارة المرور»: إذا كانت البطاقة حمراء قف، وإلا امشِ. ثم أضيفوا قاعدة ثالثة للأصفر.',
    },
  },
  {
    id: 'fn', icon: '🧩', color: '#7C3AED',
    name: { en: 'Functions', ar: 'الدوال' },
    what: {
      en: 'A function is your own new command. You build it once from other blocks and give it a name. Then you can use it again and again.',
      ar: 'الدالة أمر جديد تصنعه بنفسك. تبنيها مرة واحدة من أوامر أخرى وتعطيها اسمًا، ثم تستخدمها مرات ومرات.',
    },
    life: { en: 'Like a dance move with a name: when the teacher says "the wave", everyone knows all the steps.', ar: 'مثل حركة رقص لها اسم: عندما يقول المعلّم «الموجة» يعرف الجميع كل خطواتها.' },
    code: 'def my_move():\n    move()\n    turn_left()\n\nmy_move()\nmy_move()',
    tip: {
      en: 'Invent a move called DANCE = clap, spin, jump. Then the teacher just says "DANCE, walk, DANCE" and kids act it out.',
      ar: 'اخترعوا حركة اسمها «رقصة» = صفّق، استدر، اقفز. ثم يكفي أن يقول المعلّم «رقصة، امشِ، رقصة» ليؤدّيها الطلاب.',
    },
  },
];

const LEVELS = [
  {
    id: 'pos1', concept: 'pos',
    title: { en: 'Treasure Map', ar: 'خريطة الكنز' },
    goal: { en: 'Use "go to (x, y)" to send Fahim to every ⭐. Point at a square to see its address.', ar: 'استخدم «اذهب إلى (س، ص)» لترسل فهيم إلى كل نجمة ⭐. أشِر إلى مربع لترى عنوانه.' },
    hint: { en: 'The first ⭐ is at x = 2, y = 3. Count 2 squares across, then 3 up.', ar: 'النجمة الأولى عند س = 2، ص = 3. عُدّ مربعين بالعرض ثم 3 للأعلى.' },
    blocks: ['goto'], optimal: 3,
    maps: [['.....*', '..*...', '......', '....*.', 'S.....']],
  },
  {
    id: 'pos2', concept: 'pos',
    title: { en: 'Star Hunter', ar: 'صيّاد النجوم' },
    goal: { en: 'Collect all 4 ⭐, then finish on the flag 🏁.', ar: 'اجمع النجوم الأربع ⭐ ثم أنهِ على العلم 🏁.' },
    hint: { en: 'x is the number along the bottom, y is the number up the side. The flag is at (6, 0).', ar: 'س هو الرقم في الأسفل، و ص هو الرقم على الجانب. العلم عند (6، 0).' },
    blocks: ['goto'], optimal: 5,
    maps: [['......*', '.*.....', '.......', '.....*.', '.......', 'S..*..G']],
  },
  {
    id: 'seq1', concept: 'seq',
    title: { en: 'First Steps', ar: 'الخطوات الأولى' },
    goal: { en: 'Put the steps in the right order to drive Fahim to the flag 🏁.', ar: 'رتّب الخطوات بالترتيب الصحيح لتوصل فهيم إلى العلم 🏁.' },
    hint: { en: 'Fahim moves the way his orange nose points. Move 2, turn left, move 2.', ar: 'يتحرك فهيم باتجاه أنفه البرتقالي. تقدّم 2، استدر يسارًا، تقدّم 2.' },
    blocks: ['move', 'turnL', 'turnR'], optimal: 5,
    maps: [['##G#', '##.#', 'S..#']],
  },
  {
    id: 'seq2', concept: 'seq',
    title: { en: 'Zig-Zag Road', ar: 'الطريق المتعرّج' },
    goal: { en: 'Collect both ⭐ and reach the flag 🏁.', ar: 'اجمع النجمتين ⭐ واصل إلى العلم 🏁.' },
    hint: { en: 'Read the road like a story: move, move, turn left, move, move… what comes next?', ar: 'اقرأ الطريق كقصة: تقدّم، تقدّم، استدر يسارًا، تقدّم، تقدّم… ثم ماذا؟' },
    blocks: ['move', 'turnL', 'turnR'], optimal: 10,
    maps: [['G###', '.*.#', '##*#', 'S..#']],
  },
  {
    id: 'loop1', concept: 'loop',
    title: { en: 'Long Tunnel', ar: 'النفق الطويل' },
    goal: { en: 'The flag is 7 steps away, but you only have 2 blocks! Use a repeat loop.', ar: 'العلم يبعد 7 خطوات، لكن معك أمران فقط! استخدم حلقة التكرار.' },
    hint: { en: 'Put one "move forward" INSIDE "repeat", then set the number to 7.', ar: 'ضع «تقدّم خطوة» داخل «كرّر»، ثم اجعل الرقم 7.' },
    blocks: ['move', 'turnL', 'turnR', 'repeat'], limit: 2, optimal: 2,
    maps: [['########', 'S.*.*.*G', '########']],
  },
  {
    id: 'loop2', concept: 'loop',
    title: { en: 'Staircase', ar: 'الدرج' },
    goal: { en: 'Climb the stairs using only 5 blocks. Find the pattern that repeats!', ar: 'اصعد الدرج بخمسة أوامر فقط. ابحث عن النمط الذي يتكرّر!' },
    hint: { en: 'One stair = move, turn left, move, turn right. How many stairs are there?', ar: 'الدرجة الواحدة = تقدّم، استدر يسارًا، تقدّم، استدر يمينًا. كم درجة هناك؟' },
    blocks: ['move', 'turnL', 'turnR', 'repeat'], limit: 5, optimal: 5,
    maps: [['####G', '###.*', '##.*#', '#.*##', 'S.###']],
  },
  {
    id: 'var1', concept: 'var',
    title: { en: 'The Magic Box', ar: 'الصندوق السحري' },
    goal: { en: 'This program is almost right! Change the number in the "steps" box so Fahim reaches every corner ⭐.', ar: 'هذا البرنامج شبه صحيح! غيّر الرقم في صندوق «الخطوات» ليصل فهيم إلى كل زاوية ⭐.' },
    hint: { en: 'Count how many squares Fahim must move along one side of the garden.', ar: 'عُدّ كم مربعًا يجب أن يتقدّم فهيم على جانب واحد من الحديقة.' },
    blocks: ['move', 'turnL', 'turnR', 'repeat', 'set', 'moveVar'], optimal: 4,
    starter: [{ type: 'set', n: 1 }, { type: 'repeat', n: 4, body: [{ type: 'moveVar' }, { type: 'turnL' }] }],
    maps: [['*..*', '.##.', '.##.', 'S..*']],
  },
  {
    id: 'var2', concept: 'var',
    title: { en: 'Snail Spiral', ar: 'حلزون فهيم' },
    goal: { en: 'Each side of the spiral is one square longer than the last. Make the "steps" box grow while the loop runs!', ar: 'كل جانب في الحلزون أطول بمربع من الذي قبله. اجعل صندوق «الخطوات» يكبر أثناء عمل الحلقة!' },
    hint: { en: 'Add "change steps by 1" inside the loop, after the turn.', ar: 'أضف «غيّر الخطوات بمقدار 1» داخل الحلقة، بعد الاستدارة.' },
    blocks: ['move', 'turnL', 'turnR', 'repeat', 'set', 'change', 'moveVar'], limit: 5, optimal: 5,
    starter: [{ type: 'set', n: 1 }, { type: 'repeat', n: 5, body: [{ type: 'moveVar' }, { type: 'turnR' }] }],
    maps: [['*....G', '.#####', '.#S*##', '.##.##', '*..*##']],
  },
  {
    id: 'cond1', concept: 'cond',
    title: { en: 'Puddle Road', ar: 'طريق البرك' },
    goal: { en: 'The water 🌊 is in a different place on each road. Use IF to jump only when water is ahead. One program must work on all 3 roads!', ar: 'الماء 🌊 في مكان مختلف في كل طريق. استخدم «إذا» لتقفز فقط عندما يكون الماء أمامك. برنامج واحد يجب أن ينجح في الطرق الثلاثة!' },
    hint: { en: 'repeat until at 🏁 → if water ahead: jump over, else: move forward.', ar: 'كرّر حتى تصل 🏁 ← إذا ماء أمامك: اقفز، وإلا: تقدّم خطوة.' },
    blocks: ['move', 'jump', 'until', 'if'], conds: ['water'], limit: 6, optimal: 4,
    maps: [
      ['#########', 'S.~..~..G', '#########'],
      ['#########', 'S~...~.~G', '#########'],
      ['#########', 'S...~...G', '#########'],
    ],
  },
  {
    id: 'cond2', concept: 'cond',
    title: { en: 'Maze Runner', ar: 'عدّاء المتاهة' },
    goal: { en: 'Three different mazes, one program. When there is a wall ahead, turn right. Otherwise, keep moving.', ar: 'ثلاث متاهات مختلفة وبرنامج واحد. إذا كان أمامك جدار استدر يمينًا، وإلا استمر في التقدّم.' },
    hint: { en: 'repeat until at 🏁 → if wall ahead: turn right, else: move forward.', ar: 'كرّر حتى تصل 🏁 ← إذا جدار أمامك: استدر يمينًا، وإلا: تقدّم خطوة.' },
    blocks: ['move', 'turnL', 'turnR', 'until', 'if'], conds: ['wall'], limit: 6, optimal: 4,
    maps: [
      ['S....', '####.', '####.', '####.', 'G....'],
      ['S..##', '##.##', '##.##', 'G..##', '#####'],
      ['S....', '####.', '#G##.', '#....', '#####'],
    ],
  },
  {
    id: 'fn1', concept: 'fn',
    title: { en: 'Hop Dance', ar: 'رقصة القفز' },
    goal: { en: 'Fahim does the same "hop" 3 times, with straight parts in between. Build the hop once in My function, then use it!', ar: 'يقوم فهيم بنفس «القفزة» 3 مرات، وبينها أجزاء مستقيمة. ابنِ القفزة مرة واحدة في «دالتي» ثم استخدمها!' },
    hint: { en: 'my_move = move, turn left, move, turn right. Main program: my_move, move, my_move, move, move, my_move.', ar: 'حركتي = تقدّم، استدر يسارًا، تقدّم، استدر يمينًا. البرنامج: حركتي، تقدّم، حركتي، تقدّم، تقدّم، حركتي.' },
    blocks: ['move', 'turnL', 'turnR', 'repeat', 'call'], limit: 10, optimal: 10, mustUse: 'call',
    maps: [['######G', '###..*.', '#.*.###', 'S.#####']],
  },
  {
    id: 'fn2', concept: 'fn',
    title: { en: 'Flower Beds', ar: 'أحواض الزهور' },
    goal: { en: 'Walk around each flower bed to grab its ⭐ and end on the flag 🏁. Every bed is the same square walk, so put a loop inside your function!', ar: 'امشِ حول كل حوض زهور لتأخذ نجمته ⭐ وأنهِ على العلم 🏁. كل حوض هو نفس المشية المربعة، فضع حلقة داخل دالتك!' },
    hint: { en: 'my_move = repeat 4 [move, move, turn left]. Main program: repeat 3 [my_move, move, move].', ar: 'حركتي = كرّر 4 [تقدّم، تقدّم، استدر يسارًا]. البرنامج: كرّر 3 [حركتي، تقدّم، تقدّم].' },
    blocks: ['move', 'turnL', 'turnR', 'repeat', 'call'], limit: 9, optimal: 8, mustUse: 'call',
    maps: [['.*.*.*.', '.#.#.#.', 'S.....G']],
  },
];

const SANDBOX_DEFAULT = ['........', '........', '........', '........', '........', 'S.......'];
