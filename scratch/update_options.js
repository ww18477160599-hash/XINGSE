const fs = require('fs');

const content = fs.readFileSync('public/js/data_defaults.js', 'utf8');
const jsonStr = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
const data = JSON.parse(jsonStr);

// Comprehensive map of replacements and expansions for professional, concise (< 4 chars) terms
const replacements = {
  // 创作
  '超现实写真': '前卫先锋',
  '极致视觉冲击': '强烈张力',
  '16:10': '16:9',
  
  // 人物
  '多地域混合': '混血骨相',
  '柔和矩形脸': '折叠方脸',
  '自然不对称': '微不对称',
  '自然双眼皮': '折扇双眼',
  '低鼻根柔鼻尖': '水滴柔鼻',
  '微弧鼻梁': '驼峰微弧',
  '轻微年龄纹理': '成熟纹理',
  
  // 身材
  'L1纤细': '纤细苗条',
  'L2匀称': '匀称紧实',
  'L3运动': '运动活力',
  'L4丰腴': '丰腴饱满',
  'L5强沙漏': '曼妙沙漏',
  'L6超现实沙漏': '极致沙漏',
  '超现实细腰': '极致细腰',
  '超现实反差': '极致反差',
  'L及以上': 'L杯以上',
  '短腿比例': '娇小比例',
  
  // 上装/下装/一体装 品类与面料
  '胸衣式上装': '胸衣背心',
  '比基尼上装': '比基尼上',
  '比基尼下装': '比基尼下',
  '紧身运动裤': '紧身运裤',
  '轻薄弹力平纹针织': '轻弹平针',
  '细罗纹针织': '细罗纹针',
  '哑光泳装布': '哑光泳布',
  '竞技泳装布': '高弹泳布',
  '弹力运动布': '高弹运动',
  '金属感织物': '金属微光',
  '背部大开口': '大露背式',
  '后背深开叉': '深V露背',
  '不对称开口': '斜角微镂',
  '不对称裁片': '立体斜裁',
  '缎面蕾丝拼接': '缎面蕾丝',
  '不透明面料': '实色不透',
  '完整不透明内衬': '全遮内衬',
  '重点区域不透明内衬': '重点遮蔽',
  '局部透明外层': '微透外层',
  
  // 动作
  '双手撑椅背': '双臂撑椅',
  '低姿态运动': '低伏姿态',
  '椅面与双脚': '椅面受力',
  '双膝与双掌': '膝手受力',
  '单膝与一脚': '单膝点地',
  '双手与双脚': '四点支撑',
  '单手与双脚': '单手撑地',
  '前臂搭椅背': '倚搭椅背',
  '一手支撑一手放松': '单手侧撑',
  '双臂向前下伸': '双臂垂探',
  '坐姿腿错开': '前后错落',
  
  // 空间与摄影
  '轻微不对称': '微不对称',
  '人工室内光': '室内暖光',
  '105mm': '105焦',
  '135mm': '135焦',
  '棚拍大柔光': '柔光箱漫',
  '小面积聚光': '定点聚光',
  '夜景实用光': '夜色街光',
  '高色彩反差': '鲜明反差'
};

// Update age options to <= 4 chars: '18岁', '20岁', ...
const newAges = ['18岁', '20岁', '22岁', '24岁', '26岁', '28岁', '30岁', '32岁', '35岁', '38岁', '40岁', '45岁', '50岁'];
// Update height options to <= 4 chars: '150高', '155高', '160高', '165高', ...
const newHeights = ['150高', '155高', '160高', '165高', '170高', '175高', '180高', '185高'];
// Update underbust to <= 4 chars: '60围', '65围', '70围', ...
const newUnderbust = ['60下', '65下', '70下', '75下', '80下', '85下', '90下', '95下'];

// High realism skin texture additions (all <= 4 chars)
const realisticSkinTextures = [
  '真实肌理', '原生微绒', '透光细孔', '健康微汗', '自然微红',
  '原生泪痣', '局部雀斑', '通透微光', '胶原光泽', '薄皮透光',
  '哑光绒面', '细致冷光', '光润清透'
];

data.groups.forEach(g => {
  g.fields.forEach(f => {
    if (f.id === 'age') {
      f.options = newAges;
    } else if (f.id === 'height') {
      f.options = newHeights;
    } else if (f.id === 'underbust') {
      f.options = newUnderbust;
    } else if (f.id === 'skin_character') {
      f.options = realisticSkinTextures;
    } else {
      f.options = f.options.map(opt => {
        return replacements[opt] || opt;
      });
    }
  });
});

// Verify all options are <= 4 chars
let stillOver4 = [];
let totalOptions = 0;
data.groups.forEach(g => {
  g.fields.forEach(f => {
    totalOptions += f.options.length;
    f.options.forEach(opt => {
      if (opt.length > 4) {
        stillOver4.push({ g: g.name, f: f.name, opt, len: opt.length });
      }
    });
  });
});

console.log('Total options count:', totalOptions);
console.log('Still over 4 chars count:', stillOver4.length);
if (stillOver4.length > 0) {
  console.log(stillOver4);
} else {
  // Write updated data_defaults.js
  const newContent = `/**
 * 形色 XINGSE 内置离线默认数据库 (零网络依赖 · 4字极简高真实感典藏版)
 */
window.DEFAULT_OPTIONS_DATA = ${JSON.stringify(data)};

window.DEFAULT_PRESETS_DATA = [];
`;
  fs.writeFileSync('public/js/data_defaults.js', newContent, 'utf8');
  console.log('Successfully updated public/js/data_defaults.js with 100% <= 4 chars options!');
}
