/**
 * 形色 XINGSE 摄影导演核心算法与全维度动态无遗漏装配器 (V0.62.7 终极完备版)
 */

// 常用中英文摄影术语映射字典
const EN_TERMS_MAP = {
  // 创作基调与风格主题 (12大黄金摄影企划)
  '日系清透写真': 'Japanese airy candid photography, soft natural illumination, delicate film grain, pastel gentle tones',
  '韩系极简氛围': 'Korean editorial studio portraiture, clean dewy skin glow, sophisticated minimalism, refined tonal harmony',
  '法式慵懒随性': 'French effortless chic portraiture, golden hour natural warmth, nonchalant elegance, soft cinematic contrast',
  '港风复古胶片': '90s Hong Kong cinema vintage aesthetic, 35mm warm film grain, moody atmospheric chiaroscuro, nostalgic tones',
  '欧美高定时装': 'Western haute couture editorial, sharp sculptural bone structure, stark elegant minimalism, Vogue cover lighting',
  '新中式清冷雅韵': 'Neo-Chinese aesthetic portraiture, ethereal delicate bone structure, poetic negative space, subtle muted tones',
  '纯欲私房漫度': 'Intimate boudoir portraiture, soft diffused window light, warm gentle breathing atmosphere, delicate sensuality',
  '海边度假旅拍': 'Coastal resort summer vacation portrait, sun-drenched golden warmth, ocean breeze lookbook aesthetic',
  '街头潮流抓拍': 'Urban street fashion candid snapshot, dynamic city background, spontaneous effortless cool stance',
  '电影叙事大片': 'Cinematic 35mm film narrative still, widescreen composition, emotive dramatic lighting, rich storytelling depth',
  '复古柯达胶片': 'Authentic analog film photography, Kodak Portra 400 silver halide grain, gentle chromatic halation',
  '原生日常纪实': 'Raw unfiltered documentary portrait, authentic life snapshot, candid human warmth, natural spontaneity',

  // 外搭大片款式与穿法体态
  '廓形西装': 'oversized tailored blazer',
  '经典风衣': 'classic trench coat',
  '羊绒长大衣': 'luxurious cashmere long coat',
  '慵懒针织开衫': 'slouchy knit cardigan',
  '机车皮夹克': 'biker leather jacket',
  '粗花呢小香风': 'tweed jacket',
  '复古牛仔外套': 'vintage denim jacket',
  '哑光麂皮夹克': 'matte suede jacket',
  '羊羔毛外套': 'shearling jacket',
  '透光轻薄衬衫': 'sheer layering shirt',
  '羊绒披肩斗篷': 'cashmere cape shawl',
  '敞开衣襟迎风': 'unbuttoned and flowing open in breeze, revealing inner layering',
  '随意披在肩上': 'draped nonchalantly over shoulders in high-fashion editorial posture',
  '腰带随性系结': 'casually belted at waist, cinched silhouette',
  '单侧滑落露肩': 'slid off one shoulder, relaxed and effortlessly alluring',
  '双手插兜微敞': 'hands tucked in pockets with coat slightly open',
  '扣好立领修身': 'neatly buttoned with clean structured silhouette',

  // 构图与景别
  '全身': 'full body shot, head to toe',
  '七分身': 'three-quarter shot, knee-up portrait',
  '半身': 'medium portrait shot, waist-up portrait',
  '肩部肖像': 'close-up shoulder portrait',
  '面部特写': 'extreme close-up face shot, macro eyes and lips',
  '环境人像': 'environmental portrait with surrounding context',
  '局部裁切': 'artistic crop, intimate details',
  '背身无脸': 'faceless back view composition',

  // 光影
  '窗边柔光': 'soft natural window light, morning glow',
  '阴天漫射': 'overcast diffused light, gentle shadows',
  '午后硬光': 'direct golden afternoon sunlight, crisp shadows',
  '逆光轮廓': 'rim lighting, backlit silhouette, golden halo edge',
  '侧光': 'dramatic side lighting, chiaroscuro contrast',
  '顶侧光': 'top-side lighting, sculptural shadows',
  '冷暖双色': 'dual tone lighting, warm key light and cool fill',
  '霓虹色光': 'neon cyberpunk accents, colored gel lighting',
  '棚拍大柔光': 'profoto softbox lighting, flawless illumination',
  '小面积聚光': 'focused spotlight, high contrast accent',
  '夜景实用光': 'practical nighttime lighting, authentic ambiance',

  // 镜头
  '24mm': '24mm wide angle lens, environmental context',
  '35mm': '35mm focal length, natural documentary perspective',
  '50mm': '50mm prime lens, natural human eye perspective, f/1.4',
  '65mm': '65mm cinema lens, intimate depth',
  '85mm': '85mm portrait telephoto lens, creamy bokeh, f/1.2',
  '105mm': '105mm macro portrait lens, exquisite detail sharpness',
  '135mm': '135mm telephoto compression, dreamy soft background',

  // 构图
  '中心': 'centered composition',
  '三分': 'rule of thirds composition',
  '偏置留白': 'negative space offset composition',
  '对角线': 'diagonal leading lines composition',
  '框景': 'framed composition, natural framing',
  '深度层次': 'deep depth of field layers, layered framing'
};

// 拼接中文摄影导演提示词（全维度动态严密无遗漏注入）
function assembleChinesePrompt(selections, optionsMap) {
  const parts = [];

  // 1. 创作基调与人物身份 (Identity)
  const theme = selections['theme'] || '日系清透写真';
  const tension = selections['tension'] || '成熟优雅';
  const framing = selections['framing'] || '七分身';
  const ar = selections['aspect_ratio'] || '16:10';

  const age = selections['age'] || '20–21岁';
  const ancestry = selections['ancestry'] || '东亚';
  const faceShape = selections['face_shape'] || '鹅蛋脸';
  const bone = selections['bone_structure'] || '';
  const eyes = selections['eyes'] || '细长眼';
  const brows = selections['brows'] || '';
  const nose = selections['nose'] || '微弧鼻梁';
  const lips = selections['lips'] || '饱满唇';
  const skinTone = selections['skin_tone'] || '暖白';
  const skinChar = selections['skin_character'] || '自然原生';

  let faceFeatures = [];
  if (brows) faceFeatures.push(`${brows}`);
  if (eyes) faceFeatures.push(`清澈${eyes}`);
  if (nose) faceFeatures.push(`${nose}`);
  if (lips) faceFeatures.push(`${lips}`);
  
  let faceDesc = '';
  if (framing === '背身无脸') {
    faceDesc = '镜头置于人物后方背向构图，五官自然隐匿于视角盲区，着重突出肩颈后侧发丝飘落弧度与优美肩背线条';
  } else {
    faceDesc = faceFeatures.length > 0 ? `五官生动协调，眉眼间展现出${faceFeatures.join('、')}` : '';
  }

  let identityDesc = `【画面风格与主角】这是一幅呈现「${theme}」的专业级女性摄影作品，画幅为「${ar}」，景别为「${framing}」，整体氛围流露着「${tension}」的审美张力。出镜女性约${age}，${ancestry}面貌特征，骨相呈${bone || '精致立体骨骼'}，脸部为协调的${faceShape}。${faceDesc}。底层核心严格遵循真实人类原生皮肤光学特征：细腻原生微毛孔与次表面散射（subsurface scattering），真实的微观肌理起伏与${skinTone}健康透润血色，保留${skinChar}真实生理细节，彻底杜绝塑料磨皮假面或瓷娃娃感，散发自然鲜活的原生微光。`;
  parts.push(identityDesc);

  // 2. 身材形体解剖与比例 (Body - 全维度注入)
  const figure = selections['figure'] || 'L2匀称';
  const height = selections['height'] || '';
  const bustSize = selections['bust_size'] || '';
  const cup = selections['cup'] || '';
  const underbust = selections['underbust'] || '';
  const bustShape = selections['bust_shape'] || '';
  const waist = selections['waist'] || '';
  const whr = selections['waist_hip_ratio'] || '';
  const hipsSize = selections['hips_size'] || '';
  const hipsShape = selections['hips_shape'] || '';
  const shoulders = selections['shoulders'] || '';
  const legs = selections['legs'] || '';

  let bodyDetails = [];
  if (figure) bodyDetails.push(`体型轮廓为${figure}`);
  if (height) bodyDetails.push(`身高约${height}`);
  if (shoulders) bodyDetails.push(`${shoulders}肩线`);

  let bustDetail = [];
  if (bustSize) bustDetail.push(`${bustSize}`);
  if (cup) bustDetail.push(`${cup}罩杯`);
  if (underbust) bustDetail.push(`下胸围${underbust}`);
  if (bustShape) bustDetail.push(`自然${bustShape}`);
  if (bustDetail.length > 0) bodyDetails.push(`胸部呈现${bustDetail.join('，')}`);

  if (waist) bodyDetails.push(`${waist}`);
  if (whr) bodyDetails.push(`腰臀比例表现为${whr}`);

  let hipDetail = [];
  if (hipsSize) hipDetail.push(`${hipsSize}`);
  if (hipsShape) hipDetail.push(`${hipsShape}`);
  if (hipDetail.length > 0) bodyDetails.push(`臀部线条呈${hipDetail.join('，')}`);

  if (legs) bodyDetails.push(`双腿${legs}`);

  if (bodyDetails.length > 0) {
    parts.push(`【身材形体】整体比例表现为：${bodyDetails.join('，')}。骨骼走势与软组织转折均严谨符合人体解剖美学与自然受力下垂重力逻辑，体态舒展修长。`);
  }

  // 3. 发妆与穿搭服饰 (Styling & Outfit - 细节全覆盖)
  const hair = selections['hair'] || '长直发';
  const hairPart = selections['hair_part'] || '';
  const hairColor = selections['hair_color'] || '自然黑';
  const makeup = selections['makeup'] || '清透裸妆';
  const accessories = selections['accessories'] || '';
  const outfitMode = selections['outfit_mode'] || '上下装';
  const outerwear = selections['outerwear'] || '';
  const socks = selections['socks'] || '';
  const footwear = selections['footwear'] || '';

  let hairDesc = `${hairColor}${hairPart ? '（' + hairPart + '）' : ''}${hair}`;

  let clothingDesc = '';
  if (outfitMode === '连衣裙' || outfitMode === '连体装') {
    const kind = selections['onepiece_kind'] || '连体裙装';
    const fabric = selections['onepiece_fabric'] || '丝质面料';
    const color = selections['onepiece_color'] || '';
    const fit = selections['onepiece_fit'] || '';
    const length = selections['onepiece_length'] || '';
    const neck = selections['onepiece_neckline'] || '';
    const sleeve = selections['onepiece_sleeve'] || '';
    const cut = selections['onepiece_cutout'] || '';
    const structure = selections['onepiece_structure'] || '';
    const lining = selections['onepiece_lining'] || '';

    let opTags = [color, fabric, fit, length, neck ? `${neck}领口` : '', sleeve ? `${sleeve}` : '', cut ? `${cut}设计` : '', structure ? `${structure}` : '', lining, kind].filter(Boolean);
    clothingDesc = `身穿一件${opTags.join(' ')}`;
  } else {
    // 上下装 / 成套装
    const upKind = selections['upper_kind'] || '精致上衣';
    const upFabric = selections['upper_fabric'] || '质感织物';
    const upColor = selections['upper_color'] || '';
    const upFit = selections['upper_fit'] || '';
    const upLen = selections['upper_length'] || '';
    const upNeck = selections['upper_neckline'] || '';
    const upSleeve = selections['upper_sleeve'] || '';
    const upCut = selections['upper_cutout'] || '';
    const upStruct = selections['upper_structure'] || '';
    const upLining = selections['upper_lining'] || '';

    let upTags = [upColor, upFabric, upFit, upLen, upNeck ? `${upNeck}领` : '', upSleeve ? `${upSleeve}` : '', upCut ? `${upCut}剪裁` : '', upStruct ? `${upStruct}` : '', upLining, upKind].filter(Boolean);

    const lowKind = selections['lower_kind'] || '下装';
    const lowFabric = selections['lower_fabric'] || '';
    const lowColor = selections['lower_color'] || '';
    const lowFit = selections['lower_fit'] || '';
    const lowLen = selections['lower_length'] || '';
    const lowWaist = selections['lower_waistline'] || '';
    const lowCut = selections['lower_cutout'] || '';
    const lowStruct = selections['lower_structure'] || '';
    const lowLining = selections['lower_lining'] || '';

    let lowTags = [lowColor, lowFabric, lowFit, lowLen, lowWaist ? `${lowWaist}腰位` : '', lowCut ? `${lowCut}` : '', lowStruct ? `${lowStruct}` : '', lowLining, lowKind].filter(Boolean);

    clothingDesc = `上身着装为${upTags.join(' ')}，下身搭配${lowTags.join(' ')}`;
  }

  let extraOutfit = [];
  const outerWearStyle = selections['outerwear_wear'] || '';
  const outerFabric = selections['outerwear_fabric'] || '';
  const outerFit = selections['outerwear_fit'] || '';
  const outerLen = selections['outerwear_length'] || '';
  const outerColor = selections['outerwear_color'] || '';
  if (outerwear && outerwear !== '无外搭') {
    let outerTags = [outerColor, outerFabric, outerFit, outerLen, outerwear].filter(Boolean).join(' ');
    let outerDesc = `外搭重点呈现一件设计感${outerTags}`;
    if (outerWearStyle) outerDesc += `，以「${outerWearStyle}」的松弛姿态穿着，衣摆与轮廓在画面中占据大面积主导视觉`;
    extraOutfit.push(outerDesc);
  }
  if (socks && socks !== '无袜') extraOutfit.push(`配以${socks}`);
  if (footwear && footwear !== '赤足') extraOutfit.push(`脚踩${footwear}`);
  else if (footwear === '赤足') extraOutfit.push('赤足受力触地');

  let accessDesc = (accessories && accessories !== '无配饰') ? `，佩戴有${accessories}` : '';
  let extraDesc = extraOutfit.length > 0 ? `；${extraOutfit.join('，')}` : '';

  let stylingBlock = `【妆造服饰】发型梳理为富有空气感的${hairDesc}，妆容为${makeup}${accessDesc}。服装形式为「${outfitMode}」，${clothingDesc}${extraDesc}。面料微观织物纹理分明，受姿势牵引产生的褶皱与垂坠感真实可触。`;
  parts.push(stylingBlock);

  // 4. 动作姿态与情绪表达 (Pose - 支点/朝向/四肢全部注入)
  const posture = selections['posture'] || '自然站立';
  const bodyDir = selections['body_direction'] || '正对镜头';
  const support = selections['support'] || '';
  const hands = selections['hands'] || '自然垂落';
  const legAction = selections['leg_action'] || '';
  const headDir = selections['head_direction'] || '';
  const gaze = selections['gaze'] || '直视镜头';
  const emotion = selections['emotion'] || '自信冷静';

  let poseDesc = `【动态与情绪】模特处于${posture}状态，躯干呈${bodyDir}${support ? '，以' + support + '为关键受力支点' : ''}；双手${hands}${legAction ? '，双腿呈' + legAction : ''}；头部${headDir || '自然端正'}，眼神${gaze}，眉宇与嘴角间流露出饱满的${emotion}情绪张力，动态连贯具戏剧感。`;
  parts.push(poseDesc);

  // 5. 空间场景与环境光影 (Space - 地点/天气/空间关系/道具全覆盖)
  const spaceType = selections['space_type'] || '室内';
  const location = selections['location'] || '极简现代公寓';
  const spaceStyle = selections['space_style'] || '';
  const weather = selections['time_weather'] || '午后阳光';
  const envRelation = selections['environment_relation'] || '';
  const lighting = selections['lighting'] || '窗边柔光';
  const props = selections['props'] || '';

  let envDetails = [];
  if (spaceStyle) envDetails.push(`${spaceStyle}格调`);
  if (envRelation) envDetails.push(`人物与环境${envRelation}`);
  if (props && props !== '无道具') envDetails.push(`现场陈列道具含${props}`);

  let envBlock = `【场景与光影】置身于${spaceType}的${location}（${weather}）中${envDetails.length > 0 ? '，' + envDetails.join('，') : ''}。主照明光源为「${lighting}」，高光细腻微泛，暗部保留通透层次，光影明暗交界线柔和过渡，环境空间纵深感极佳。`;
  parts.push(envBlock);

  // 6. 摄影器材、构图与光学质感 (Camera - 高度/角度/焦段/成色/附加要求)
  const cameraHeight = selections['camera_height'] || '平视';
  const cameraAngle = selections['camera_angle'] || '';
  const lens = selections['lens'] || '85mm';
  const composition = selections['composition'] || '三分法构图';
  const imaging = selections['imaging'] || '胶片电影质感';
  const notes = selections['notes'] || '';

  let camDetails = [`采用${cameraHeight}机位`];
  if (cameraAngle) camDetails.push(`${cameraAngle}视角`);
  camDetails.push(`配备${lens}人像光学镜头`);
  camDetails.push(`运用${composition}`);
  camDetails.push(`成像色彩风格为「${imaging}」`);

  let camBlock = `【摄影器材与成片质感】${camDetails.join('，')}。光学焦外散景如奶油般化开，焦点内发丝、睫毛与织物纤维极致锐利通透，色彩反差自然，极具《Vogue》高端摄影特辑品质。${notes ? '【附加专属指令】：' + notes : ''}`;
  parts.push(camBlock);

  return parts.join('\n\n');
}

// 拼接英文 AI 生图提示词 (Diffusion / Flux - 85 字段精准英文翻译全注入，绝无中文夹杂)
function assembleEnglishPrompt(selections) {
  const toEnSafe = (typeof toEn === 'function') ? toEn : (val => {
    if (typeof window !== 'undefined' && window.toEn) return window.toEn(val);
    if (typeof XINGSE_EN_DICT !== 'undefined' && XINGSE_EN_DICT[val]) return XINGSE_EN_DICT[val];
    return String(val || '');
  });

  const tags = [
    'masterpiece',
    'award-winning professional photography',
    'hyper-detailed cinematic portrait of a beautiful adult woman',
    'shot on Hasselblad H6D-100c',
    'medium format camera',
    'sharp focus',
    'natural film grain'
  ];

  // 1. 创作基调与风格主题
  if (selections['theme']) {
    const t = toEnSafe(selections['theme']);
    if (t) tags.push(t);
  }
  if (selections['tension']) {
    const ten = toEnSafe(selections['tension']);
    if (ten) tags.push(`${ten} aesthetic tension`);
  }
  if (selections['framing']) {
    const f = toEnSafe(selections['framing']);
    if (f) tags.push(f);
  }

  // 2. 人物身份属性与生理级真实微观皮肤质感
  if (selections['age']) tags.push(toEnSafe(selections['age']));
  if (selections['ancestry']) tags.push(`${toEnSafe(selections['ancestry'])} ethnic features`);
  if (selections['framing'] === '背身无脸') {
    tags.push('shot from behind, back view, faceless portrait, face turned away and hidden from camera, elegant silhouette of nape and shoulders');
  } else {
    if (selections['face_shape']) tags.push(toEnSafe(selections['face_shape']));
    if (selections['bone_structure']) tags.push(toEnSafe(selections['bone_structure']));
    if (selections['eyes']) tags.push(toEnSafe(selections['eyes']));
    if (selections['brows']) tags.push(toEnSafe(selections['brows']));
    if (selections['nose']) tags.push(toEnSafe(selections['nose']));
    if (selections['lips']) tags.push(toEnSafe(selections['lips']));
  }
  if (selections['skin_tone']) tags.push(toEnSafe(selections['skin_tone']));
  
  // 核心微观皮肤光学表征：细腻原生毛孔、次表面散射、自然微瑕，坚决杜绝塑料磨皮
  const skinChar = selections['skin_character'] ? toEnSafe(selections['skin_character']) : 'authentic skin physiology';
  tags.push(`authentic human physiological skin texture, visible microscopic pores, delicate vellus peach fuzz in rim light, soft translucent subsurface scattering (SSS), natural skin translucency, ${skinChar}, zero plastic doll smoothing, zero airbrushed CGI artifacts, raw optical medium-format capture`);

  // 3. 身材比例
  if (selections['figure']) tags.push(toEnSafe(selections['figure']));
  if (selections['height']) tags.push(toEnSafe(selections['height']));
  if (selections['bust_size'] || selections['cup'] || selections['bust_shape']) {
    const bParts = [toEnSafe(selections['bust_size']), toEnSafe(selections['cup']), toEnSafe(selections['bust_shape'])].filter(Boolean);
    let bStr = bParts.join(' ');
    if (!bStr.includes('breast') && !bStr.includes('bust')) bStr += ' bust';
    tags.push(bStr);
  }
  if (selections['waist']) {
    let wStr = toEnSafe(selections['waist']);
    if (!wStr.includes('waist')) wStr += ' waist';
    tags.push(wStr);
  }
  if (selections['waist_hip_ratio']) tags.push(toEnSafe(selections['waist_hip_ratio']));
  if (selections['hips_size'] || selections['hips_shape']) {
    const hParts = [toEnSafe(selections['hips_size']), toEnSafe(selections['hips_shape'])].filter(Boolean);
    let hStr = hParts.join(' ');
    if (!hStr.includes('hip') && !hStr.includes('glute') && !hStr.includes('rear') && !hStr.includes('derriere')) hStr += ' hips';
    tags.push(hStr);
  }
  if (selections['shoulders']) tags.push(toEnSafe(selections['shoulders']));
  if (selections['legs']) tags.push(toEnSafe(selections['legs']));

  // 4. 发妆与配饰
  const hairParts = [toEnSafe(selections['hair_color']), toEnSafe(selections['hair_part']), toEnSafe(selections['hair'])].filter(Boolean);
  if (hairParts.length > 0) tags.push(hairParts.join(', '));
  if (selections['makeup']) tags.push(toEnSafe(selections['makeup']));
  if (selections['accessories'] && selections['accessories'] !== '无配饰') {
    const acc = toEnSafe(selections['accessories']);
    if (acc) tags.push(`accessorized with ${acc}`);
  }

  // 5. 服装搭配
  const mode = selections['outfit_mode'] || '上下装';
  if (mode === '连衣裙' || mode === '连体装') {
    const op = [
      toEnSafe(selections['onepiece_color']),
      toEnSafe(selections['onepiece_fabric']),
      toEnSafe(selections['onepiece_fit']),
      toEnSafe(selections['onepiece_length']),
      toEnSafe(selections['onepiece_neckline']),
      toEnSafe(selections['onepiece_sleeve']),
      toEnSafe(selections['onepiece_cutout']),
      toEnSafe(selections['onepiece_kind'])
    ].filter(Boolean).join(', ');
    if (op) tags.push(`wearing ${op}`);
  } else {
    const up = [
      toEnSafe(selections['upper_color']),
      toEnSafe(selections['upper_fabric']),
      toEnSafe(selections['upper_fit']),
      toEnSafe(selections['upper_length']),
      toEnSafe(selections['upper_neckline']),
      toEnSafe(selections['upper_sleeve']),
      toEnSafe(selections['upper_cutout']),
      toEnSafe(selections['upper_kind'])
    ].filter(Boolean).join(', ');

    const low = [
      toEnSafe(selections['lower_color']),
      toEnSafe(selections['lower_fabric']),
      toEnSafe(selections['lower_fit']),
      toEnSafe(selections['lower_length']),
      toEnSafe(selections['lower_waistline']),
      toEnSafe(selections['lower_cutout']),
      toEnSafe(selections['lower_kind'])
    ].filter(Boolean).join(', ');

    if (up) tags.push(`wearing ${up}`);
    if (low) tags.push(`paired with ${low}`);
  }

  // 外搭大片呈现
  if (selections['outerwear'] && selections['outerwear'] !== '无外搭') {
    const outerParts = [
      toEnSafe(selections['outerwear_color']),
      toEnSafe(selections['outerwear_fabric']),
      toEnSafe(selections['outerwear_fit']),
      toEnSafe(selections['outerwear_length']),
      toEnSafe(selections['outerwear']),
      toEnSafe(selections['outerwear_wear'])
    ].filter(Boolean);
    if (outerParts.length > 0) {
      tags.push(`prominent outerwear layering: wearing ${outerParts.join(', ')}, dominating visual silhouette with tactile fabric drape`);
    }
  }

  if (selections['socks'] && selections['socks'] !== '无袜') {
    const s = toEnSafe(selections['socks']);
    if (s) tags.push(s);
  }
  if (selections['footwear'] && selections['footwear'] !== '赤足') {
    const fw = toEnSafe(selections['footwear']);
    if (fw) tags.push(fw);
  } else if (selections['footwear'] === '赤足') {
    tags.push('barefoot');
  }

  // 6. 动作姿态与情绪
  if (selections['posture']) tags.push(toEnSafe(selections['posture']));
  if (selections['body_direction']) tags.push(toEnSafe(selections['body_direction']));
  if (selections['support']) tags.push(`support: ${toEnSafe(selections['support'])}`);
  if (selections['hands']) tags.push(`hands: ${toEnSafe(selections['hands'])}`);
  if (selections['leg_action']) tags.push(`legs: ${toEnSafe(selections['leg_action'])}`);
  if (selections['head_direction']) tags.push(`head: ${toEnSafe(selections['head_direction'])}`);
  if (selections['gaze']) tags.push(toEnSafe(selections['gaze']));
  if (selections['emotion']) tags.push(toEnSafe(selections['emotion']));

  // 7. 环境场景与光影
  if (selections['space_type']) tags.push(toEnSafe(selections['space_type']));
  if (selections['location']) tags.push(`set in ${toEnSafe(selections['location'])}`);
  if (selections['space_style']) tags.push(toEnSafe(selections['space_style']));
  if (selections['time_weather']) tags.push(toEnSafe(selections['time_weather']));
  if (selections['environment_relation']) tags.push(toEnSafe(selections['environment_relation']));
  if (selections['props'] && selections['props'] !== '无道具') {
    const pr = toEnSafe(selections['props']);
    if (pr) tags.push(`surrounding props: ${pr}`);
  }
  if (selections['lighting']) tags.push(toEnSafe(selections['lighting']));

  // 8. 镜头光学参数与胶片质感
  if (selections['camera_height']) tags.push(toEnSafe(selections['camera_height']));
  if (selections['camera_angle']) tags.push(toEnSafe(selections['camera_angle']));
  if (selections['lens']) tags.push(`${selections['lens']} prime portrait lens, f/1.4 aperture`);
  if (selections['composition']) tags.push(toEnSafe(selections['composition']));
  if (selections['imaging']) tags.push(toEnSafe(selections['imaging']));
  if (selections['notes']) tags.push(toEnSafe(selections['notes']));

  // 9. 画幅与渲染引擎增强
  const ar = selections['aspect_ratio'];
  if (ar) {
    if (ar === '16:10' || ar === '16:9' || ar === '3:2' || ar === '4:3') {
      tags.push(`wide landscape orientation, ${ar} aspect ratio, cinematic widescreen, --ar ${ar}`);
    } else if (ar === '9:16' || ar === '2:3' || ar === '3:4' || ar === '4:5') {
      tags.push(`vertical portrait orientation, ${ar} aspect ratio, tall frame, --ar ${ar}`);
    } else if (ar === '1:1') {
      tags.push(`square 1:1 format, --ar 1:1`);
    }
  }

  tags.push('8k resolution, highly detailed, photorealistic, natural creamy bokeh');

  // 10. 终极绝对无中文字符防线：严格滤除任何中文字符与空项
  const cleanTags = tags
    .map(t => t.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff01-\uffee]/g, '').trim())
    .map(t => t.replace(/\s+/g, ' ').trim())
    .filter(t => t.length > 0 && t !== 'wearing' && t !== 'paired with' && t !== 'support:' && t !== 'hands:' && t !== 'legs:' && t !== 'head:' && t !== 'surrounding props:');

  return cleanTags.join(', ');
}

// 画幅与真实生图分辨率精准映射表
const ASPECT_RATIO_SIZE_MAP = {
  '1:1': { width: 1024, height: 1024, label: '1024×1024' },
  '16:10': { width: 1440, height: 900, label: '1440×900' },
  '16:9': { width: 1344, height: 768, label: '1344×768' },
  '3:2': { width: 1216, height: 816, label: '1216×816' },
  '4:3': { width: 1152, height: 864, label: '1152×864' },
  '3:4': { width: 864, height: 1152, label: '864×1152' },
  '2:3': { width: 816, height: 1216, label: '816×1216' },
  '9:16': { width: 768, height: 1344, label: '768×1344' },
  '4:5': { width: 896, height: 1120, label: '896×1120' }
};

function getActualSubmitSize(aspectRatio) {
  const item = ASPECT_RATIO_SIZE_MAP[aspectRatio] || ASPECT_RATIO_SIZE_MAP['1:1'];
  return `${item.width}x${item.height}`;
}

function getActualSubmitSizeInfo(aspectRatio) {
  return ASPECT_RATIO_SIZE_MAP[aspectRatio] || { width: 1024, height: 1024, label: '1024×1024' };
}

// 提取方案的七维美学签名（用于近期10次去重比对）
function extract7DSignature(selections) {
  const mode = selections['outfit_mode'] || '上下装';
  const outfitDesc = (mode === '连衣裙' || mode === '连体装')
    ? `${selections['onepiece_kind'] || ''} ${selections['onepiece_fabric'] || ''} ${selections['onepiece_color'] || ''}`
    : `${selections['upper_kind'] || ''}配${selections['lower_kind'] || ''} ${selections['upper_color'] || ''}`;

  return {
    character: `${selections['ancestry'] || '东亚'} ${selections['face_shape'] || ''} ${selections['hair'] || ''}`.trim(),
    outfit: `${mode}: ${outfitDesc}`.trim(),
    support: `${selections['posture'] || '站立'} (支点:${selections['support'] || '地面'})`.trim(),
    composition: `${selections['framing'] || '七分身'} ${selections['composition'] || '三分法'} @ ${selections['location'] || '室内'}`.trim(),
    camera: `${selections['camera_height'] || '平视'} ${selections['lens'] || '85mm'}`.trim(),
    lighting: `${selections['lighting'] || '窗边柔光'} ${selections['imaging'] || ''}`.trim(),
    emotion: `${selections['emotion'] || '自信冷静'} (视线:${selections['gaze'] || '直视'})`.trim()
  };
}

// 摄影美学与物理常识冲突互斥规则引擎
function checkOptionConflict(fieldId, optionValue, currentSelections) {
  if (!currentSelections || !optionValue) return null;

  // 1. 赤足与穿袜互斥 (Footwear & Socks)
  if (fieldId === 'socks') {
    const fw = currentSelections['footwear'];
    if (fw === '赤足' && optionValue !== '无袜') {
      return { conflict: true, reason: '当前已选择「赤足」，无法穿袜' };
    }
  }
  if (fieldId === 'footwear') {
    const s = currentSelections['socks'];
    if (optionValue === '赤足' && s && s !== '无袜') {
      return { conflict: true, reason: `当前已选择「${s}」，无法赤足` };
    }
  }

  // 2. 空间分类与场景地点互斥 (Space Type & Location)
  const INDOOR_LOCATIONS = ['现代公寓', '极简现代公寓', '厨房', '书房', '卧室', '剧院后台', '走廊', '咖啡馆', '图书馆', '健身空间', '舞蹈空间', '酒店', '工业空间'];
  const OUTDOOR_LOCATIONS = ['庭院', '露台', '城市街道', '车站', '停车场', '海岸', '泳池', '湖岸', '山路', '草原', '花园', '海滨沙滩', '林荫道', '公园草坪', '礁石海边', '天台', '斑马线', '公路边'];
  const STUDIO_LOCATIONS = ['黑棚', '白棚', '彩色棚'];

  if (fieldId === 'location') {
    const st = currentSelections['space_type'];
    if (st === '室内' && (OUTDOOR_LOCATIONS.includes(optionValue) || STUDIO_LOCATIONS.includes(optionValue))) {
      return { conflict: true, reason: '当前已选择「室内」，与室外/纯影棚场景相悖' };
    }
    if (st === '室外' && (INDOOR_LOCATIONS.includes(optionValue) || STUDIO_LOCATIONS.includes(optionValue))) {
      return { conflict: true, reason: '当前已选择「室外」，与室内/纯影棚场景相悖' };
    }
    if (st === '摄影棚' && (INDOOR_LOCATIONS.includes(optionValue) || OUTDOOR_LOCATIONS.includes(optionValue))) {
      return { conflict: true, reason: '当前已选择「摄影棚」，与真实生活场景相悖' };
    }
  }
  if (fieldId === 'space_type') {
    const loc = currentSelections['location'];
    if (optionValue === '室内' && OUTDOOR_LOCATIONS.includes(loc)) {
      return { conflict: true, reason: `当前地点为「${loc}」，与室内相悖` };
    }
    if (optionValue === '室外' && INDOOR_LOCATIONS.includes(loc)) {
      return { conflict: true, reason: `当前地点为「${loc}」，与室外相悖` };
    }
    if (optionValue === '摄影棚' && (INDOOR_LOCATIONS.includes(loc) || OUTDOOR_LOCATIONS.includes(loc))) {
      return { conflict: true, reason: `当前地点为「${loc}」，与影棚相悖` };
    }
  }

  // 3. 时间天气与光影照明互斥 (Time/Weather & Lighting)
  const DAYLIGHT_LIGHTS = ['午后硬光', '午后阳光'];
  const NIGHT_WEATHERS = ['夜晚'];
  const OVERCAST_WEATHERS = ['暴雨', '阴天', '雪天'];
  const DAYLIGHT_WEATHERS = ['清晨', '午后', '晴天'];

  if (fieldId === 'lighting') {
    const tw = currentSelections['time_weather'];
    if (NIGHT_WEATHERS.includes(tw) && DAYLIGHT_LIGHTS.includes(optionValue)) {
      return { conflict: true, reason: '当前天气为「夜晚」，与午后强日光相悖' };
    }
    if (OVERCAST_WEATHERS.includes(tw) && DAYLIGHT_LIGHTS.includes(optionValue)) {
      return { conflict: true, reason: `当前天气为「${tw}」，与强日照硬光相悖` };
    }
    if (DAYLIGHT_WEATHERS.includes(tw) && optionValue === '夜景实用光') {
      return { conflict: true, reason: `当前天气为「${tw}」，与夜景实用光相悖` };
    }
  }
  if (fieldId === 'time_weather') {
    const lt = currentSelections['lighting'];
    if (NIGHT_WEATHERS.includes(optionValue) && DAYLIGHT_LIGHTS.includes(lt)) {
      return { conflict: true, reason: `当前主光为「${lt}」，与夜晚环境相悖` };
    }
    if (OVERCAST_WEATHERS.includes(optionValue) && DAYLIGHT_LIGHTS.includes(lt)) {
      return { conflict: true, reason: `当前主光为「${lt}」，与阴雨天气相悖` };
    }
    if (DAYLIGHT_WEATHERS.includes(optionValue) && lt === '夜景实用光') {
      return { conflict: true, reason: '当前主光为「夜景实用光」，与日间/晴天相悖' };
    }
  }

  // 4. 体态姿势与受力支点互斥 (Posture & Support)
  const STANDING_POSTURES = ['自然站立', '单腿承重', '交叉腿站', '迈步', '回身', '旋转舞姿', '低姿态运动', '动态跳跃'];
  const LYING_POSTURES = ['仰卧', '侧卧', '俯卧', '蜷缩侧卧', '躺椅半卧'];
  const KNEELING_POSTURES = ['跪坐', '双膝跪姿', '单膝跪姿', '跪姿前倾'];
  const SITTING_POSTURES = ['坐姿前倾', '反坐椅子', '侧坐', '端坐', '盘腿坐', '坐台沿'];

  if (fieldId === 'support') {
    const p = currentSelections['posture'];
    if (STANDING_POSTURES.includes(p) && ['床面', '躺椅', '双膝与双掌'].includes(optionValue)) {
      return { conflict: true, reason: `当前姿态为站立动作，与「${optionValue}」承托相悖` };
    }
    if (LYING_POSTURES.includes(p) && ['双脚', '单脚', '双手与双脚', '单手与双脚'].includes(optionValue)) {
      return { conflict: true, reason: `当前姿态为卧姿，与「${optionValue}」立姿受力相悖` };
    }
    if (KNEELING_POSTURES.includes(p) && ['双脚', '单脚', '躺椅'].includes(optionValue)) {
      return { conflict: true, reason: `当前姿态为跪姿，与「${optionValue}」受力相悖` };
    }
    if (SITTING_POSTURES.includes(p) && ['单脚', '双脚'].includes(optionValue)) {
      return { conflict: true, reason: `当前为坐姿，与纯「${optionValue}」立姿受力相悖` };
    }
  }
  if (fieldId === 'posture') {
    const sp = currentSelections['support'];
    if (STANDING_POSTURES.includes(optionValue) && ['床面', '躺椅', '双膝与双掌'].includes(sp)) {
      return { conflict: true, reason: `当前支点为「${sp}」，与站立姿态相悖` };
    }
    if (LYING_POSTURES.includes(optionValue) && ['双脚', '单脚', '双手与双脚', '单手与双脚'].includes(sp)) {
      return { conflict: true, reason: `当前支点为「${sp}」，与卧姿相悖` };
    }
    if (KNEELING_POSTURES.includes(optionValue) && ['双脚', '单脚', '躺椅'].includes(sp)) {
      return { conflict: true, reason: `当前支点为「${sp}」，与跪姿相悖` };
    }
    if (SITTING_POSTURES.includes(optionValue) && ['单脚', '双脚'].includes(sp)) {
      return { conflict: true, reason: `当前支点为「${sp}」，与坐姿相悖` };
    }
  }

  // 5. 构图景别与视线互斥 (Framing & Gaze)
  if (fieldId === 'gaze') {
    const fr = currentSelections['framing'];
    if (fr === '背身无脸' && ['直视镜头', '看镜头旁', '向下看', '侧向看'].includes(optionValue)) {
      return { conflict: true, reason: '当前景别为「背身无脸」，正视/侧视镜头相悖' };
    }
  }
  if (fieldId === 'framing') {
    const gz = currentSelections['gaze'];
    if (optionValue === '背身无脸' && ['直视镜头', '看镜头旁', '向下看', '侧向看'].includes(gz)) {
      return { conflict: true, reason: `当前眼神已选「${gz}」，与背身无脸相悖` };
    }
  }

  return null;
}

// 库内随机采样（严格保留用户已锁定项，仅重抽生效分区的未锁定项，抽中结果绝不自动加锁，且严格规避逻辑冲突）
function sampleOptionsRandomly(fieldsList, currentSelections, lockedFields, isFieldActiveFn) {
  const newSelections = { ...currentSelections };

  for (const field of fieldsList) {
    // 1. 用户已锁定的项，绝对跳过保留
    if (lockedFields && lockedFields[field.id]) {
      continue;
    }

    // 2. 当前分区停用的项，跳过不抽
    if (isFieldActiveFn && !isFieldActiveFn(field.id)) {
      continue;
    }

    const allOptions = [...(field.options || []), ...(field.customOptions || [])];
    if (allOptions.length === 0) continue;

    // 3. 严格过滤掉与已选/已锁项冲突的选项
    const validOptions = allOptions.filter(opt => !checkOptionConflict(field.id, opt, newSelections));
    const candidateOptions = validOptions.length > 0 ? validOptions : allOptions;

    if (field.type === 'single') {
      const randomIndex = Math.floor(Math.random() * candidateOptions.length);
      newSelections[field.id] = candidateOptions[randomIndex];
    } else if (field.type === 'multi') {
      const count = Math.min(candidateOptions.length, Math.floor(Math.random() * 2) + 1);
      const shuffled = [...candidateOptions].sort(() => 0.5 - Math.random());
      newSelections[field.id] = shuffled.slice(0, count).join('/');
    }
  }

  return newSelections;
}

// 导演协调搭配（按照摄影美学协调未锁定字段）
function directorCoordinateMatch(fieldsList, currentSelections, lockedFields, isFieldActiveFn) {
  const newSelections = sampleOptionsRandomly(fieldsList, currentSelections, lockedFields, isFieldActiveFn);

  // 美学微调联动逻辑（在未锁定时做协调）
  if (newSelections['theme'] === '泳装写真' && (!lockedFields || !lockedFields['location'])) {
    newSelections['location'] = '海岸沙滩';
  }
  if (newSelections['theme'] === '电影叙事' && (!lockedFields || !lockedFields['imaging'])) {
    newSelections['imaging'] = '胶片电影质感';
  }
  if (newSelections['theme'] === '棚拍肖像' && (!lockedFields || !lockedFields['space_type'])) {
    newSelections['space_type'] = '摄影棚';
  }

  return newSelections;
}

// 导出挂载到全局
window.XingSeDirector = {
  assembleChinesePrompt,
  assembleEnglishPrompt,
  sampleOptionsRandomly,
  directorCoordinateMatch,
  checkOptionConflict,
  ASPECT_RATIO_SIZE_MAP,
  getActualSubmitSize,
  getActualSubmitSizeInfo,
  extract7DSignature
};
