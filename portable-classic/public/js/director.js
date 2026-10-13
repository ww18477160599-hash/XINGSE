/**
 * 形色 XINGSE 摄影导演核心算法与全维度动态无遗漏装配器 (V0.62.7 终极完备版)
 */

// 常用中英文摄影术语映射字典
const EN_TERMS_MAP = {
  // 创作
  '生活写真': 'lifestyle candid photography',
  '时尚编辑': 'high-fashion editorial, Vogue cover style',
  '街头穿搭': 'street style fashion photoshoot, urban candid',
  '度假旅拍': 'resort vacation portrait, cinematic travel photography',
  '泳装写真': 'swimsuit lookbook photoshoot, summer beach aesthetic',
  '内衣广告': 'intimate lingerie commercial, refined sensuality',
  '运动写真': 'athletic sports portrait, dynamic fitness',
  '棚拍肖像': 'studio portrait, profoto lighting, clean seamless backdrop',
  '电影叙事': 'cinematic narrative frame, 35mm film still',
  '清新自然': 'fresh and natural vibe, soft ethereal mood',
  '温柔亲近': 'gentle intimate atmosphere, cozy aesthetic',
  '成熟优雅': 'sophisticated elegance, regal presence',
  '冷艳疏离': 'cool aloof demeanor, distant aristocratic elegance',
  '慵懒妩媚': 'effortless sultry charm, languid sensuality',
  '极致视觉冲击': 'striking visual impact, hyper-aesthetic tension',

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

// 拼接中文摄影导演提示词（全85字段动态严密无遗漏注入）
function assembleChinesePrompt(selections, optionsMap) {
  const parts = [];

  // 1. 创作基调与人物身份 (Identity)
  const theme = selections['theme'] || '时尚写真';
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
  const skinChar = selections['skin_character'] || '自然均匀';

  let faceFeatures = [];
  if (brows) faceFeatures.push(`${brows}`);
  if (eyes) faceFeatures.push(`清澈${eyes}`);
  if (nose) faceFeatures.push(`${nose}`);
  if (lips) faceFeatures.push(`${lips}`);
  const faceDesc = faceFeatures.length > 0 ? `五官生动协调，眉眼间展现出${faceFeatures.join('、')}` : '';

  let identityDesc = `【画面风格与主角】这是一幅呈现「${theme}」的专业级女性摄影作品，画幅为「${ar}」，景别为「${framing}」，整体氛围流露着「${tension}」的审美张力。出镜女性约${age}，${ancestry}面貌特征，骨相呈${bone || '精致立体骨骼'}，脸部为协调的${faceShape}。${faceDesc}。肌肤呈现细腻温润的${skinTone}肤色与真实的${skinChar}光学质感，告别塑料磨皮假感，散发自然健康的原生微光。`;
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
  if (outerwear && outerwear !== '无外搭') extraOutfit.push(`外披${outerwear}`);
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

// 拼接英文 AI 生图提示词 (Diffusion / Flux - 85 字段精准英文翻译全注入)
function assembleEnglishPrompt(selections) {
  const tags = [
    'masterpiece',
    'award-winning professional photography',
    'hyper-detailed cinematic portrait of a beautiful adult woman',
    'shot on Hasselblad H6D-100c',
    'medium format camera',
    'sharp focus',
    'natural film grain'
  ];

  // 创作与景别
  if (selections['theme']) tags.push(`${EN_TERMS_MAP[selections['theme']] || selections['theme'] + ' photoshoot'}`);
  if (selections['framing']) tags.push(`${EN_TERMS_MAP[selections['framing']] || selections['framing']}`);

  // 人物属性
  if (selections['age']) tags.push(`${selections['age'].replace('岁', ' years old')}`);
  if (selections['ancestry']) tags.push(`${selections['ancestry']} ethnic features`);
  if (selections['face_shape']) tags.push(`${selections['face_shape']} face`);
  if (selections['bone_structure']) tags.push(`${selections['bone_structure']}`);
  if (selections['eyes']) tags.push(`${selections['eyes']} eyes`);
  if (selections['brows']) tags.push(`${selections['brows']} eyebrows`);
  if (selections['nose']) tags.push(`${selections['nose']} nose`);
  if (selections['lips']) tags.push(`${selections['lips']} lips`);
  if (selections['skin_tone']) tags.push(`${selections['skin_tone']} skin tone`);
  if (selections['skin_character']) tags.push(`authentic skin texture, ${selections['skin_character']}, natural pores, no plastic blur`);

  // 身材比例
  if (selections['figure']) tags.push(`${selections['figure']} body shape`);
  if (selections['height']) tags.push(`${selections['height']}`);
  if (selections['bust_size'] || selections['cup']) {
    tags.push(`${[selections['bust_size'], selections['cup'] ? selections['cup'] + ' cup' : '', selections['bust_shape']].filter(Boolean).join(' ')} breasts`);
  }
  if (selections['waist']) tags.push(`${selections['waist']} waist`);
  if (selections['waist_hip_ratio']) tags.push(`${selections['waist_hip_ratio']} waist-to-hip ratio`);
  if (selections['hips_size'] || selections['hips_shape']) {
    tags.push(`${[selections['hips_size'], selections['hips_shape']].filter(Boolean).join(' ')} hips`);
  }
  if (selections['legs']) tags.push(`${selections['legs']} legs`);

  // 发妆
  if (selections['hair_color'] || selections['hair']) {
    tags.push(`${selections['hair_color'] || 'dark'} ${selections['hair_part'] ? selections['hair_part'] + ' ' : ''}${selections['hair'] || 'flowing hair'}`);
  }
  if (selections['makeup']) tags.push(`${selections['makeup']} makeup`);
  if (selections['accessories'] && selections['accessories'] !== '无配饰') {
    tags.push(`wearing ${selections['accessories']}`);
  }

  // 服装搭配
  const mode = selections['outfit_mode'] || '上下装';
  if (mode === '连衣裙' || mode === '连体装') {
    const op = [
      selections['onepiece_color'],
      selections['onepiece_fabric'],
      selections['onepiece_fit'],
      selections['onepiece_length'],
      selections['onepiece_neckline'],
      selections['onepiece_cutout'],
      selections['onepiece_kind'] || 'dress'
    ].filter(Boolean).join(' ');
    if (op) tags.push(`wearing ${op}`);
  } else {
    const up = [
      selections['upper_color'],
      selections['upper_fabric'],
      selections['upper_fit'],
      selections['upper_neckline'],
      selections['upper_cutout'],
      selections['upper_kind'] || 'top'
    ].filter(Boolean).join(' ');

    const low = [
      selections['lower_color'],
      selections['lower_fabric'],
      selections['lower_fit'],
      selections['lower_waistline'],
      selections['lower_cutout'],
      selections['lower_kind'] || 'bottom'
    ].filter(Boolean).join(' ');

    if (up) tags.push(`wearing ${up}`);
    if (low) tags.push(`paired with ${low}`);
  }

  if (selections['outerwear'] && selections['outerwear'] !== '无外搭') tags.push(`outerwear ${selections['outerwear']}`);
  if (selections['socks'] && selections['socks'] !== '无袜') tags.push(`${selections['socks']}`);
  if (selections['footwear'] && selections['footwear'] !== '赤足') tags.push(`${selections['footwear']}`);
  else if (selections['footwear'] === '赤足') tags.push('barefoot');

  // 动作姿态与情绪
  if (selections['posture']) tags.push(`${selections['posture']}`);
  if (selections['body_direction']) tags.push(`${selections['body_direction']}`);
  if (selections['support']) tags.push(`resting on ${selections['support']}`);
  if (selections['hands']) tags.push(`hands ${selections['hands']}`);
  if (selections['leg_action']) tags.push(`legs ${selections['leg_action']}`);
  if (selections['head_direction']) tags.push(`head ${selections['head_direction']}`);
  if (selections['gaze']) tags.push(`eyes looking ${selections['gaze']}`);
  if (selections['emotion']) tags.push(`${selections['emotion']} facial expression`);

  // 环境光影
  if (selections['location']) tags.push(`set in ${selections['location']}`);
  if (selections['space_style']) tags.push(`${selections['space_style']} interior style`);
  if (selections['time_weather']) tags.push(`${selections['time_weather']}`);
  if (selections['environment_relation']) tags.push(`${selections['environment_relation']}`);
  if (selections['props'] && selections['props'] !== '无道具') tags.push(`surrounding props: ${selections['props']}`);
  if (selections['lighting']) tags.push(`${EN_TERMS_MAP[selections['lighting']] || selections['lighting'] + ' lighting'}`);

  // 镜头参数
  if (selections['camera_height']) tags.push(`${selections['camera_height']} angle`);
  if (selections['camera_angle']) tags.push(`${selections['camera_angle']}`);
  if (selections['lens']) tags.push(`${selections['lens']} prime lens, f/1.4 aperture`);
  if (selections['composition']) tags.push(`${EN_TERMS_MAP[selections['composition']] || selections['composition']}`);
  if (selections['imaging']) tags.push(`${selections['imaging']} aesthetic`);
  if (selections['notes']) tags.push(`${selections['notes']}`);

  // 画幅比例控制与结尾增强
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

  return tags.join(', ');
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

// 库内随机采样（严格保留用户已锁定项，仅重抽生效分区的未锁定项，抽中结果绝不自动加锁）
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

    if (field.type === 'single') {
      const randomIndex = Math.floor(Math.random() * allOptions.length);
      newSelections[field.id] = allOptions[randomIndex];
    } else if (field.type === 'multi') {
      const count = Math.min(allOptions.length, Math.floor(Math.random() * 2) + 1);
      const shuffled = [...allOptions].sort(() => 0.5 - Math.random());
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
  ASPECT_RATIO_SIZE_MAP,
  getActualSubmitSize,
  getActualSubmitSizeInfo,
  extract7DSignature
};
