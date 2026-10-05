"""Manually chosen C02 semantic verdicts. Execution only records decisions."""
import importlib.util
from pathlib import Path
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('reviewer',HERE/'record-review.py')
reviewer=importlib.util.module_from_spec(spec); spec.loader.exec_module(reviewer)
DECISIONS=[
 ('estonian-maausk','ready',dict(context=2,objects=2,space=2,sequence=2,sensory=2,variants=2,boundaries=2,provenance=2),
  '主审：已实际读组织2009HTML与民俗资料，窗边纪念和现代传播有依据，亡灵返家只列信仰自述；原创木框玻璃窗台陶盘蜡柱棉芯和纸卡具体，接触支撑与内外前后可绘。光从未亮到稳定再灭、卡保留与重入复空终态明确，不冒称送魂；材质光学及默认无声、窗与墓变体和圣林主持边界具体。基线选象征窗边，无需伪造真实住宅，限定小品可通过。',
  [('盘心托蜡柱','器物支撑与原创材质明确'),('玻璃在烛后','内外相对位置可绘'),('棉芯复为未亮','过程结束状态明确')],
  '已补组织亡灵季窗烛背景、原创窗台木框玻璃及陶盘烛卡形制起止；主审通过限定切片。')
]
DECISIONS += [
 ('celtic-folk','ready',dict(context=2,objects=2,space=2,sequence=2,sensory=2,variants=2,boundaries=2,provenance=2),
  '主审阅读全文：巴斯罗马遗址限定且前罗马敬奉保留推测，未泛称凯尔特仪轨。原评估允许原创泉边体验，石岸内衬出口、托盘木片和岸上纸签板均具体标原创；片从盘到水面再回收，纸签保留与清除的终态可编写，材料声画及文化边界清楚。通过仅针对原创切片。',
  [('盘沿阻止圆片滚落','托盘与圆片支撑具体'),('二者不悬在水上','岸上器物空间明确'),('木片随虚拟水流缓慢到后侧出口并进入回收区','原创结束状态可写')],
  '已核巴斯机构资料，明确原创池岸木片纸签板及完整回收终态；主审通过。'),
 ('buyei-traditional','ready',dict(context=2,objects=2,space=2,sequence=2,sensory=2,variants=2,boundaries=2,provenance=2),
  '主审阅读全文：望谟申报项与糯米五色、宴客对歌对应，原卡许可共享饭致敬，改成原创桌面有依据并记录原因。陶瓷碗盘圈足、木桌腿横撑和勺头结构可绘，分饭源碗缺口与终盘小堆勺归位可写；不以原创桌面冒称真实歌圩复原。真实歌圩是明确排除的未来扩展，不阻断本次原创饭桌。',
  [('底部窄圈足贴住桌面','碗的结构支撑明确'),('两只浅碗在左、三只在右','器物布局可绘'),('勺回到桌边，原碗仍留大部分饭','分饭终态明确')],
  '已补望谟非遗背景、原创碗盘桌勺形制布局与分饭起止；通过限定原创饭桌。'),
 ('cornish-folk','ready',dict(context=2,objects=2,space=2,sequence=None,sensory=2,variants=2,boundaries=2,provenance=2),
  '主审阅读全文：Madron井和邻近小堂分址，遗产登记明示石衬井、花岗岩台阶及水路；实际系布树照片只辨可见表面，不猜纤维树种。两张图文保持静态，sequence=null有合理解释；位置、历史民俗分期和保护边界可用于公开资料展示。',
  [('小型矩形、石衬、积水井穴','井体形制材质已实证'),('北墙入口、东西向内部空间','小堂空间明确'),('本切片静态，sequence 不适用','静态范围明确')],
  '已补Madron井与小堂遗产结构和实际系布树观察，静态图文通过。'),
 ('chagga-traditional','needs_research',dict(context=2,objects=1,space=2,sequence=2,sensory=1,variants=2,boundaries=2,provenance=2),
  '主审阅读全文：调查解决Machame Mamba取水低堤及主支渠园地拓扑，原创箭头说明有明确起止。主体渠段截面、岸体材料与实际水面支撑仍不足，不能据石堤推导沿线石衬渠；保留partial，不计齐备。',
  [('用石块和巨石组成低堤','已核取水结构'),('选定主渠及园内支渠的岸体材质、截面、连接与实际表面仍不足','核心缺口仍阻断')],
  '已补Machame引水拓扑和维护背景；渠体截面岸材待研究，不计完成。'),
 ('chinese-buddhism','needs_research',dict(context=2,objects=1,space=1,sequence=1,sensory=1,variants=2,boundaries=2,provenance=2),
  '主审阅读全文：供灯意义和历史场合有官方依据，正确区分宝塔灯与登记光明灯，2025修缮装置不移植2020。实际单灯材质器型、安放支撑与光源起止缺失，原创合十不足以解决供灯主体，保留partial。',
  [('单盏容器轮廓、燃料或电光、底座、玻璃罩／莲瓣、支撑台架与材料均未确认','供灯核心器物缺口'),('双手停留合十姿态，所选善意文字保持显示','仅原创合十终态已明确')],
  '已补佛光山供灯意义与宝塔灯区别；登记单灯形制空间起止待研究。')
]
DECISIONS += [
 ('dalecarlian-folk','ready',dict(context=2,objects=2,space=2,sequence=None,sensory=2,variants=2,boundaries=2,provenance=2),
  '主审研究并完整写读：社区给出具名两船年代及各部件木种铜铆钉，实际两张图片辨船首船板肋骨座板和河岸系泊。另地历史船屋不移植Tibble。主体限定静态系泊图文，未见教堂仅作位置标记，sequence=null且无划桨脚本；可据文画出有支撑船体与码头关系，通过限定范围。',
  [('横向座板依次跨接左右舷','船体结构具体'),('船长轴与木板码头近似平行','河岸位置可绘'),('开始与结束都是已系泊船体照片和结构说明','静态过程边界明确')],
  '已补Tibble社区船体材种连接、实际河岸照片与历史现代变体；静态图文通过。'),
 ('corsican-folk','ready',dict(context=2,objects=2,space=2,sequence=None,sensory=2,variants=2,boundaries=2,provenance=2),
  '主审阅读全文：官方文本具名双色墙石与建筑身份，代理实际看两张官方列图，低堂高塔和院门草地山景可绘；未核屋顶与院门材种留为静态外观附属未知，无需假定施工规格。原山村教堂外观具体化有据，静态sequence=null，不拼接游行治疗唱法。',
  [('浅白石为 Saint-Florent 石灰岩','墙体主材料具名'),('门与石墩为前景，教堂在草地内侧中景','观看关系明确'),('sequence=null','静态范围限定')],
  '已补Murato双色石堂、院界山景与真实照片观察；静态外观通过。'),
 ('breton-pardons','needs_research',dict(context=2,objects=1,space=2,sequence=2,sensory=1,variants=2,boundaries=2,provenance=2),
  '主审阅读全文：Locronan石堂调查解决建筑材质和体块，旗帜类型有研究，但具名旗架横杆杆材悬挂握持仍未观察；原创队列起止不能代替主体器物证据，objects=1保留partial。',
  [('旗杆材质、旗面如何悬在杆上','主物件仍欠明确'),('队列到右侧停步并离开观察范围','原创过程结束已写')],
  '已补Locronan石堂调查与旗帜类型、原创队列起止；旗架握持材质待研究。'),
 ('chinese-folk-and-confucian','ready',dict(context=2,objects=2,space=2,sequence=2,sensory=1,variants=2,boundaries=2,provenance=2),
  '主审阅读全文：龙山寺公开2017减香与1979器物研究分期，铜铸鼓腹三足、焊接与配件托泥支撑均可绘。内埕前殿正殿关系明确；只作简化结构和原创数量标识合十演出，真实燃香芯材与装饰未见部分明确排除，不以一寺代全国或祭孔。八维满足此限定切片。',
  [('炉腹分前后铸造后焊合','器物结构有寺方原始研究'),('足部接触托泥底板，底板落在地面','承托结构具体'),('主炉结构、合十姿态与','结束显示状态明确')],
  '已补龙山寺历史减香制度、铜铸炉简化结构与内埕关系，原创无燃烧说明演出通过。')
]
DECISIONS += [
 ('emilian-folk','ready',dict(context=2,objects=2,space=2,sequence=None,sensory=2,variants=2,boundaries=2,provenance=2),
  '主审实际研究写读：市政地图解决上山分段，2019完整修缮HTML核墙拱顶抹灰砌体，实际外侧图片明确拱洞壁墩低墙屋面和道路下方城市。限定静态外侧照片与关系图，屋面材种廊内铺地明确不复原；不把外道路材料移植廊内。sequence=null不声称完整行走或巡游，范围有据且可绘主体。',
  [('砌体结构加抹灰饰面','主体材料有市政文本'),('落地壁墩托住拱与上方连续屋面','可绘支撑关系'),('初始和结束都是同一山坡外观与路线关系图','静态过程范围明确')],
  '已补San Luca外侧柱拱表面支撑及实际照片、路线分段；限定静态图文通过。')
]
DECISIONS += [
 ('czech-moravian-folk','ready',dict(context=2,objects=2,space=2,sequence=2,sensory=2,variants=2,boundaries=2,provenance=2),
  '主审实际研究写读：圣所PDF和国家机构支持地方传说分期与丘顶圣殿，实际官方远景明确林丘建筑山脊。不造近景步道与实景留言桌；独立原创硬紙簿脊页木桌腿陶盘蜡柱棉芯支撑可绘，书写点光熄灭字保留重入复空可写，声画和宗教边界明确。原评估容许山丘意向簿致敬，通过此限定切片。',
  [('蜡柱底贴盘中心','原创器具支撑关系'),('陶盘烛在左后侧','桌面位置可绘'),('重开时文字复空、烛未亮','过程终态与重入明确')],
  '已补Hostýn官方丘顶远景与地方史，原创簿烛材料支撑及熄灭重入终态；通过。'),
 ('calabrian-folk','needs_research',dict(context=2,objects=1,space=1,sequence=None,sensory=1,variants=2,boundaries=2,provenance=2),
  '主审阅读全文：Polsi文化部1980建筑档案补混合砌体三廊多坡金属板屋面，但现存外立面轮廓前场观看关系和声画表面未见；历史结构不得当2026裸露外观。静态sequence=null合理，核心材形空间仍缺，保留partial。',
  [('主体为砖与石块混合砌体','历史调查已补材料'),('前场与山坡、附属楼、道路的实际前后左右关系仍未核验','现存空间阻断')],
  '已补Polsi历史建筑结构档案及山区语境；当前立面前场待研究。'),
 ('catalan-folk','needs_research',dict(context=2,objects=1,space=2,sequence=2,sensory=1,variants=2,boundaries=2,provenance=2),
  '主审阅读全文：2017Protocol固定新对巨人集合巡游回广场次序，正确分离旧对与另一镇材料。所选新对头身衣物框架与人接触仍欠证据，公开序列可介绍但不能据常见纸糊猜主物；objects=1不计齐备。',
  [('内部框架材质与横撑、承载者接触位置','主体器物关键缺口'),('巡游返回 Plaça Nova','公开过程结束有据')],
  '已补Plaça Nova2017新对巡游起止路线与新旧区别；主巨人壳体承载结构待研究。'),
 ('chuukese-traditional','needs_research',dict(context=1,objects=1,space=1,sequence=1,sensory=1,variants=2,boundaries=2,provenance=2),
  '主审阅读全文：Tonoas家庭原始访谈明确历史初熟给村长家族头与后来圣诞共食，未证实原定教堂初熟。无证活动身份不是足以确立另一归属的矛盾，保留needs_research；包食物有叶材但折法盘架及教堂空间全过程仍缺，原创阅读序列不能抵消。',
  [('不是“初熟供献移入某座教堂”的证据','范围实例未证'),('没有可核定的方包、圆包、折角或叶柄绑结照片','核心物件形制不足')],
  '已核楚克家庭食物访谈并区分初熟与教会节日共食；原定教堂实例包形空间待研究。')
]
DECISIONS += [
 ('ewe-traditional','needs_research',dict(context=2,objects=2,space=1,sequence=2,sensory=1,variants=2,boundaries=2,provenance=2),
  '主审实际研究写读：旅游与社区一手正文固定Anlo/Anloga及Hogbe Park历史节目，迁徙传说与倒退纪念保持概念，实际配图为2019海报不能当2025场地。原创木板槽座棉布陶盘与擦拭置板终态具体，但首领公众广场拓扑与现场材形无同次证据，space=1保留partial，不以原创台面替代。',
  [('板下缘插入有槽的窄木座','原创符号支撑明确'),('尚不能画出同一次公开durbar中首领台/棚、观者边界、中央空地及入口','真实主体空间阻断'),('桌面灰标已无，布仍在盘','原创结束状态具体')],
  '已补Anlo出走纪念与社区节目、剔除2019海报场地误用，原创符号起止具体；真实durbar布局待研究。'),
 ('circassian-traditional','ready',dict(context=2,objects=2,space=2,sequence=2,sensory=2,variants=2,boundaries=2,provenance=2),
  '主审阅读全文：Gelendzhik具名ane桌档案与代理实物像素区分，白蜡木圆桌三足横撑可绘；历史款待书客位、饮食书茶饼均对应而不作同次宴席。原创杯盘低凳布局让座推盘收手终态清楚，撤去无依据圣林灯，不重现祷词或themade主持。八维通过限定伦理致敬。',
  [('三个车制节状木足','核心桌体结构实证'),('客凳在远侧面向前方入口','文化参照与原创位置明确'),('盘由中间移至客人可及处，饼仍在盘内','分享可见变化与终态')],
  '已补馆藏ane木桌材形、公开款待与茶饼参照，原创让座分享起止完整；通过。'),
 ('crimean-tatar-traditional','ready',dict(context=2,objects=2,space=2,sequence=2,sensory=2,variants=2,boundaries=2,provenance=2),
  '主审阅读全文：2024Musafir社区餐会、实际主办方全景与当前餐厅汤菜单对应且时点分开，未将当前分店菜单倒填历史活动。原创陶碗勺壶杯木桌材形布置具体，分餐汤面变化、勺回托盘、日常点头祝愿和独立抽象海平线圆环起止完整；真实开斋身份步骤不复演。原评估本为原创共餐和平光，调整有依据未缩成介绍，通过限定产品切片。',
  [('圈足接触桌面','原创碗支撑与材料具体'),('两碗各有一份，中心碗汤面降低；勺回托盘','分餐起止可写'),('光环是平面说明板上的可见圆环','和平光空间非实景海岸明确')],
  '已補Musafir公开餐会与真实桌列观察，原创汤碗分餐日常祝愿和平光四阶段完整；通过。'),
 ('croatian-folk','ready',dict(context=2,objects=2,space=2,sequence=None,sensory=2,variants=2,boundaries=2,provenance=2),
  '主审阅读全文：文化部石砖抹灰立面与建筑群描述、政府实际俯瞰图分别关联，塔主堂廊院外广场高低支撑可绘；未把未读照片或橙红屋面猜成具体材种。静态sequence=null合理，不冒称礼拜或精确建筑复原，文化分期与公开边界齐备。',
  [('可见石构件、砖墙、抹灰','主体材质有官方一手文本'),('塔最高、主堂次之、廊屋低','形制空间可绘'),('起始、结束同为固定外观','静态过程范围明确')],
  '已补Marija Bistrica文化部墙体材质与政府整体照片廊院广场关系；静态图文通过。'),
 ('cypriot-folk','ready',dict(context=2,objects=2,space=2,sequence=None,sensory=2,variants=2,boundaries=2,provenance=2),
  '主审阅读全文：官方讲解石构分期与院地关系，实际图片长墙台阶门窗远塔山坡可绘，博物馆内部材质不移植外墙，海拔差异保留。未知檐门屋面材种不伪造，对限定静态照片图文不阻断；sequence=null不声称行走揭像或鸣钟。',
  [('1541年灾后以石重建','主体石构文化分期有据'),('右侧阶梯近、远处钟楼在左后方','可绘深度位置'),('读者仅从图中认识构件','静态观看限定')],
  '已补Kykkos官方石构分期、院落阶梯长墙远塔照片观察与资料差异；静态通过。')
]
if __name__=='__main__':
 for d in DECISIONS:
  if not (HERE/'reviews'/f'{d[0]}.json').exists(): reviewer.record(*d)
