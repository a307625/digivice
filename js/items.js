/**
 * Official V-pet item / HUD sprites.
 *
 * 8x8 symbols and digits are exact bitmaps from
 *   /workspace/ui-research/ref/berational/SymbolData.h
 *   /workspace/ui-research/ref/berational/LettersAndDigits.h
 * (same 8x8 structure as the 1997 device; not a pixel-for-pixel ROM dump
 *  except the heart outline quoted in the 1997 disassembly §7).
 * Colorized in the official DMC multi-tone style: arrangement unchanged,
 * black bits become darker outline / feature tones.
 *
 * skull, grave, wall, shot, hit: reconstructed in official device style
 * because firmware / TSR UI pixels were not in the research extract.
 * See ui-research/ui-spec.md.
 */
(function (root) {
  'use strict';

  var RAW_SYMBOLS = {"empty":[0,0,0,0,0,0,0,0],"pet":[36,126,90,126,102,255,0,0],"scale":[130,254,16,124,68,68,84,254],"heart_empty":[0,108,146,130,130,68,40,16],"heart":[0,108,190,190,254,124,56,16],"age":[0,32,80,136,248,136,136,0],"weight":[56,72,56,12,120,136,112,0],"percent":[0,33,82,84,42,21,37,66],"arrow":[0,32,48,248,252,248,48,32],"meat":[3,29,42,94,126,124,184,192],"half_meat":[3,13,30,22,44,80,160,192],"empty_meat":[3,5,10,20,40,80,160,192],"pill":[14,19,47,95,142,132,136,112],"half_pill":[0,0,0,96,208,168,152,112],"am":[120,196,252,196,0,236,212,212],"pm":[120,196,248,192,0,236,212,212],"empty_triangle":[128,64,32,64,128,0,0,0],"triangle":[128,192,224,192,128,0,0,0],"poop":[128,66,129,18,24,52,94,126],"poopwave":[0,0,136,85,170,221,119,34]};
  var RAW_DIGITS = {"0":[96,144,144,144,144,144,96],"1":[32,96,32,32,32,32,32],"2":[96,144,16,32,64,128,240],"3":[96,144,16,96,16,144,96],"4":[32,96,160,160,160,240,32],"5":[240,128,128,224,16,16,224],"6":[96,144,128,224,144,144,96],"7":[240,144,16,32,32,32,32],"8":[96,144,144,96,144,144,96],"9":[96,144,144,112,16,144,96]};
  var RAW_SMALL = [[113,83,81,81,113],[119,17,119,65,119],[87,84,119,17,23],[119,69,113,81,113],[119,85,119,81,119]];
  var RAW_LETTERS = {"A":{"w":4,"rows":[96,144,144,240,144,144]},"B":{"w":4,"rows":[224,144,224,144,144,224]},"C":{"w":4,"rows":[96,144,128,128,144,96]},"D":{"w":4,"rows":[224,144,144,144,144,224]},"E":{"w":4,"rows":[240,128,240,128,128,240]},"F":{"w":4,"rows":[240,128,240,128,128,128]},"G":{"w":4,"rows":[96,144,128,176,144,96]},"H":{"w":4,"rows":[144,144,240,144,144,144]},"I":{"w":3,"rows":[224,64,64,64,64,224]},"J":{"w":4,"rows":[240,16,16,16,144,96]},"K":{"w":4,"rows":[144,160,192,160,144,144]},"L":{"w":4,"rows":[128,128,128,128,128,240]},"M":{"w":5,"rows":[136,216,248,168,168,168]},"N":{"w":5,"rows":[136,200,168,152,136,136]},"O":{"w":4,"rows":[96,144,144,144,144,96]},"P":{"w":4,"rows":[224,144,144,224,128,128]},"Q":{"w":5,"rows":[100,144,144,144,176,120]},"R":{"w":4,"rows":[224,144,144,224,144,144]},"S":{"w":4,"rows":[96,144,64,32,144,96]},"T":{"w":5,"rows":[248,32,32,32,32,32]},"U":{"w":4,"rows":[144,144,144,144,144,96]},"V":{"w":5,"rows":[136,136,136,136,80,32]},"W":{"w":5,"rows":[168,168,168,248,112,80]},"X":{"w":5,"rows":[136,80,32,80,136,136]},"Y":{"w":5,"rows":[136,80,32,32,32,32]},"Z":{"w":5,"rows":[248,16,32,64,128,248]}};
  var RAW_RECON = {"skull":[126,219,219,255,255,90,102,60],"grave":[2016,8184,16380,14364,14748,14748,16380,14748,14748,14364,16380,16380,16380,32766,65535,32766],"wall":[16380,27310,30038,27310,30038,27310,30038,27310,30038,27310,30038,27310,30038,27310,32766,16380],"shot":[24,60,126,219,24,24,60,0],"hit":[384,4488,10644,5544,3024,1440,29646,64959,64959,29646,1440,3024,5544,10644,4488,384]};
  var ITEMS = {"empty":{"w":8,"h":8,"pal":["#00000000"],"frames":{"idle0":["00000000","00000000","00000000","00000000","00000000","00000000","00000000","00000000"]},"src":"official"},"pet":{"w":8,"h":8,"pal":["#00000000","#32362aff","#505644ff","#1a1c16ff"],"frames":{"idle0":["00100100","01222210","01022010","01222210","02200220","31111113","00000000","00000000"]},"src":"official"},"scale":{"w":8,"h":8,"pal":["#00000000","#1a1c16ff","#32362aff","#505644ff"],"frames":{"idle0":["10000010","12222210","00030000","01222100","02000200","01000100","02020200","12222210"]},"src":"official"},"heart_empty":{"w":8,"h":8,"pal":["#00000000","#501008ff"],"frames":{"idle0":["00000000","01101100","10010010","10000010","10000010","01000100","00101000","00010000"]},"src":"official"},"heart":{"w":8,"h":8,"pal":["#00000000","#501008ff","#e05048ff","#c02018ff"],"frames":{"idle0":["00000000","01102200","10222220","10333330","13333330","03333300","00333000","00010000"]},"src":"official"},"age":{"w":8,"h":8,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["00000000","00100000","01010000","20002000","22122000","20002000","10001000","00000000"]},"src":"official"},"weight":{"w":8,"h":8,"pal":["#00000000","#1a1c16ff","#32362aff","#505644ff"],"frames":{"idle0":["00121000","01002000","00122000","00003200","01122000","10002000","01110000","00000000"]},"src":"official"},"percent":{"w":8,"h":8,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["00000000","00100001","01010010","01020200","00202020","00020201","00100101","01000010"]},"src":"official"},"arrow":{"w":8,"h":8,"pal":["#00000000","#1a1c16ff","#505644ff","#32362aff"],"frames":{"idle0":["00000000","00100000","00220000","32222000","22222300","32222000","00220000","00100000"]},"src":"official"},"meat":{"w":8,"h":8,"pal":["#00000000","#e8c8a0ff","#c46e30ff","#7a3a18ff","#2a180cff"],"frames":{"idle0":["00000011","00022201","00202010","03033330","03333330","03333300","30333000","43000000"]},"src":"official"},"half_meat":{"w":8,"h":8,"pal":["#00000000","#e8c8a0ff","#c46e30ff","#7a3a18ff","#2a180cff"],"frames":{"idle0":["00000011","00002201","00022210","00030330","00303300","03030000","30300000","43000000"]},"src":"official"},"empty_meat":{"w":8,"h":8,"pal":["#00000000","#e8c8a0ff"],"frames":{"idle0":["00000011","00000101","00001010","00010100","00101000","01010000","10100000","11000000"]},"src":"official"},"pill":{"w":8,"h":8,"pal":["#00000000","#281c30ff","#c8506eff","#f0dce4ff"],"frames":{"idle0":["00001220","00020023","00202233","01022333","10003330","10000300","10001000","01110000"]},"src":"official"},"half_pill":{"w":8,"h":8,"pal":["#00000000","#c8506eff","#281c30ff","#f0dce4ff"],"frames":{"idle0":["00000000","00000000","00000000","01100000","11010000","10101000","20013000","02130000"]},"src":"official"},"am":{"w":8,"h":8,"pal":["#00000000","#32362aff","#1a1c16ff","#505644ff"],"frames":{"idle0":["01122000","13000100","33121100","11000200","00000000","11101200","33010100","11020200"]},"src":"official"},"pm":{"w":8,"h":8,"pal":["#00000000","#32362aff","#1a1c16ff","#505644ff"],"frames":{"idle0":["01122000","13000200","33122000","11000000","00000000","11101200","33010100","11020200"]},"src":"official"},"empty_triangle":{"w":8,"h":8,"pal":["#00000000","#1a1c16ff"],"frames":{"idle0":["10000000","01000000","00100000","01000000","10000000","00000000","00000000","00000000"]},"src":"official"},"triangle":{"w":8,"h":8,"pal":["#00000000","#1a1c16ff","#32362aff","#505644ff"],"frames":{"idle0":["10000000","23000000","33200000","23000000","10000000","00000000","00000000","00000000"]},"src":"official"},"poop":{"w":8,"h":8,"pal":["#00000000","#2a1c0cff","#5a3a18ff","#8c6028ff","#b48c46ff"],"frames":{"idle0":["10000000","01000010","10000001","00010010","00022000","00230200","02034320","01223320"]},"src":"official"},"poopwave":{"w":8,"h":8,"pal":["#00000000","#103050ff","#2060a0ff","#50b0d8ff"],"frames":{"idle0":["00000000","00000000","10001000","02020201","20203020","23033302","02320232","00200020"]},"src":"official"},"skull":{"w":8,"h":8,"pal":["#00000000","#c8c4b8ff","#f0ece0ff","#fffffaff"],"frames":{"idle0":["01111110","12022021","22022022","23333332","12333321","02022020","01200210","00111100"]},"src":"reconstructed"},"grave":{"w":16,"h":16,"pal":["#00000000","#30322eff","#5a5c56ff","#82847cff"],"frames":{"idle0":["0000012222100000","0001233333321000","0013322222233100","0023200000023200","0023200110023200","0023200220023200","0023211221123200","0023200220023200","0023200110023200","0023200000023200","0023322222233200","0023333333333200","0023333333333200","0233333333333320","1233333333333321","0122222222222210"]},"src":"reconstructed"},"wall":{"w":16,"h":16,"pal":["#00000000","#6e4620ff","#a8763aff","#d2aa64ff"],"frames":{"idle0":["0011111111111100","0120202020202210","0222010101010320","0230101010102220","0222010101010320","0230101010102220","0222010101010320","0230101010102220","0222010101010320","0230101010102220","0222010101010320","0230101010102220","0222010101010320","0230202020202320","0123232323233310","0012222222222100"]},"src":"reconstructed"},"shot":{"w":8,"h":8,"pal":["#00000000","#dcb428ff","#fff078ff","#ffffe6ff","#282008ff"],"frames":{"idle0":["00011000","00233200","01233210","41022014","00022000","00022000","00411400","00000000"]},"src":"reconstructed"},"hit":{"w":16,"h":16,"pal":["#00000000","#dc5018ff","#281808ff","#ffc83cff","#ffffc8ff"],"frames":{"idle0":["0000000110000000","0002000330002000","0020100330010200","0001010330101000","0000103333010000","0000010440100000","0131003333001310","1444310330134441","1444310330134441","0131003333001310","0000010440100000","0000103333010000","0001010330101000","0020100330010200","0002000330002000","0000000110000000"]},"src":"reconstructed"},"digit_0":{"w":4,"h":7,"pal":["#00000000","#1a1c16ff"],"frames":{"idle0":["0110","1001","1001","1001","1001","1001","0110"]},"src":"official"},"digit_1":{"w":4,"h":7,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["0010","0220","0020","0010","0010","0010","0010"]},"src":"official"},"digit_2":{"w":4,"h":7,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["0110","1001","0001","0010","0100","2000","1211"]},"src":"official"},"digit_3":{"w":4,"h":7,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["0110","1001","0001","0120","0001","1001","0110"]},"src":"official"},"digit_4":{"w":4,"h":7,"pal":["#00000000","#1a1c16ff","#32362aff","#505644ff"],"frames":{"idle0":["0010","0220","1020","1010","2020","1322","0020"]},"src":"official"},"digit_5":{"w":4,"h":7,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["1211","2000","2000","1210","0001","0001","1110"]},"src":"official"},"digit_6":{"w":4,"h":7,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["0110","1001","2000","2210","2001","1001","0110"]},"src":"official"},"digit_7":{"w":4,"h":7,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["1221","1002","0001","0010","0010","0010","0010"]},"src":"official"},"digit_8":{"w":4,"h":7,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["0110","1001","1001","0220","1001","1001","0110"]},"src":"official"},"digit_9":{"w":4,"h":7,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["0110","1001","1002","0122","0002","1001","0110"]},"src":"official"},"sdigit_0":{"w":3,"h":5,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["121","202","101","202","121"]},"src":"official"},"sdigit_1":{"w":3,"h":5,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["001","022","002","001","001"]},"src":"official"},"sdigit_2":{"w":3,"h":5,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["121","002","121","200","121"]},"src":"official"},"sdigit_3":{"w":3,"h":5,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["121","002","122","002","121"]},"src":"official"},"sdigit_4":{"w":3,"h":5,"pal":["#00000000","#1a1c16ff","#32362aff","#505644ff"],"frames":{"idle0":["101","202","132","002","001"]},"src":"official"},"sdigit_5":{"w":3,"h":5,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["121","200","121","002","121"]},"src":"official"},"sdigit_6":{"w":3,"h":5,"pal":["#00000000","#1a1c16ff","#32362aff","#505644ff"],"frames":{"idle0":["121","200","231","202","121"]},"src":"official"},"sdigit_7":{"w":3,"h":5,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["121","102","001","001","001"]},"src":"official"},"sdigit_8":{"w":3,"h":5,"pal":["#00000000","#1a1c16ff","#32362aff","#505644ff"],"frames":{"idle0":["121","202","232","202","121"]},"src":"official"},"sdigit_9":{"w":3,"h":5,"pal":["#00000000","#1a1c16ff","#32362aff","#505644ff"],"frames":{"idle0":["121","202","132","002","121"]},"src":"official"},"letter_A":{"w":4,"h":6,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["0110","1001","2002","2222","2002","1001"]},"src":"official"},"letter_B":{"w":4,"h":6,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["1210","2001","2220","2001","2001","1210"]},"src":"official"},"letter_C":{"w":4,"h":6,"pal":["#00000000","#1a1c16ff"],"frames":{"idle0":["0110","1001","1000","1000","1001","0110"]},"src":"official"},"letter_D":{"w":4,"h":6,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["1210","2001","1001","1001","2001","1210"]},"src":"official"},"letter_E":{"w":4,"h":6,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["1211","2000","2211","2000","2000","1211"]},"src":"official"},"letter_F":{"w":4,"h":6,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["1211","2000","2211","2000","1000","1000"]},"src":"official"},"letter_G":{"w":4,"h":6,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["0110","1001","1000","1011","1002","0110"]},"src":"official"},"letter_H":{"w":4,"h":6,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["1001","2002","2222","2002","1001","1001"]},"src":"official"},"letter_I":{"w":3,"h":6,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["121","020","010","010","020","121"]},"src":"official"},"letter_J":{"w":4,"h":6,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["1121","0002","0001","0001","1001","0110"]},"src":"official"},"letter_K":{"w":4,"h":6,"pal":["#00000000","#1a1c16ff","#32362aff","#505644ff"],"frames":{"idle0":["1001","2010","2300","2010","1001","1001"]},"src":"official"},"letter_L":{"w":4,"h":6,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["1000","1000","1000","1000","2000","1211"]},"src":"official"},"letter_M":{"w":5,"h":6,"pal":["#00000000","#1a1c16ff","#32362aff","#505644ff"],"frames":{"idle0":["10001","23032","23332","20202","10101","10101"]},"src":"official"},"letter_N":{"w":5,"h":6,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["10001","22001","20102","10022","10002","10001"]},"src":"official"},"letter_O":{"w":4,"h":6,"pal":["#00000000","#1a1c16ff"],"frames":{"idle0":["0110","1001","1001","1001","1001","0110"]},"src":"official"},"letter_P":{"w":4,"h":6,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["1210","2001","2001","2210","2000","1000"]},"src":"official"},"letter_Q":{"w":5,"h":6,"pal":["#00000000","#1a1c16ff","#32362aff","#505644ff"],"frames":{"idle0":["01100","10010","10010","10020","10330","02221"]},"src":"official"},"letter_R":{"w":4,"h":6,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["1210","2001","2001","2220","2001","1001"]},"src":"official"},"letter_S":{"w":4,"h":6,"pal":["#00000000","#1a1c16ff"],"frames":{"idle0":["0110","1001","0100","0010","1001","0110"]},"src":"official"},"letter_T":{"w":5,"h":6,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["12221","00200","00100","00100","00100","00100"]},"src":"official"},"letter_U":{"w":4,"h":6,"pal":["#00000000","#1a1c16ff"],"frames":{"idle0":["1001","1001","1001","1001","1001","0110"]},"src":"official"},"letter_V":{"w":5,"h":6,"pal":["#00000000","#1a1c16ff"],"frames":{"idle0":["10001","10001","10001","10001","01010","00100"]},"src":"official"},"letter_W":{"w":5,"h":6,"pal":["#00000000","#1a1c16ff","#32362aff","#505644ff"],"frames":{"idle0":["10101","10101","20202","23332","03330","01010"]},"src":"official"},"letter_X":{"w":5,"h":6,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["10001","01010","00200","01010","10001","10001"]},"src":"official"},"letter_Y":{"w":5,"h":6,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["10001","01010","00200","00100","00100","00100"]},"src":"official"},"letter_Z":{"w":5,"h":6,"pal":["#00000000","#1a1c16ff","#32362aff"],"frames":{"idle0":["11221","00020","00100","01000","20000","12111"]},"src":"official"}};

  var cache = {};

  function decodeHex(h) {
    if (!h || h === '#00000000') return [0, 0, 0, 0];
    var s = h.charAt(0) === '#' ? h.slice(1) : h;
    var n = s.length;
    var r = parseInt(s.slice(0, 2), 16);
    var g = parseInt(s.slice(2, 4), 16);
    var b = parseInt(s.slice(4, 6), 16);
    var a = n >= 8 ? parseInt(s.slice(6, 8), 16) : 255;
    return [r, g, b, a];
  }

  function render(name, scale, flip, frame) {
    scale = scale || 1;
    frame = frame || 'idle0';
    var key = name + ':' + scale + ':' + (flip ? 1 : 0) + ':' + frame;
    if (cache[key]) return cache[key];
    var sp = ITEMS[name];
    if (!sp) return null;
    var rows = (sp.frames[frame] || sp.frames.idle0);
    var w = sp.w, h = sp.h;
    var c = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
    if (!c) return null;
    c.width = w * scale;
    c.height = h * scale;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    var img = ctx.createImageData(w, h);
    var pal = sp.pal;
    var chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    for (var y = 0; y < h; y++) {
      var row = rows[y];
      for (var x = 0; x < w; x++) {
        var sx = flip ? (w - 1 - x) : x;
        var i = chars.indexOf(row.charAt(sx));
        if (i < 0) i = 0;
        var rgba = decodeHex(pal[i] || '#00000000');
        var p = (y * w + x) * 4;
        img.data[p] = rgba[0];
        img.data[p + 1] = rgba[1];
        img.data[p + 2] = rgba[2];
        img.data[p + 3] = rgba[3];
      }
    }
    var tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.drawImage(tmp, 0, 0, c.width, c.height);
    cache[key] = c;
    return c;
  }

  function blit(ctx, name, x, y, scale, flip) {
    var c = render(name, scale || 1, flip);
    if (c) ctx.drawImage(c, Math.round(x), Math.round(y));
  }

  function bitGrid(rows, w, h, msbShift) {
    msbShift = msbShift || 0;
    var g = [];
    for (var y = 0; y < h; y++) {
      var line = [];
      var r = rows[y];
      for (var x = 0; x < w; x++) {
        var bit = 7 - msbShift - x;
        line.push(((r >> bit) & 1) ? 1 : 0);
      }
      g.push(line);
    }
    return g;
  }

  function drawDigit(ctx, n, x, y, scale) {
    n = Math.abs(n | 0) % 10;
    blit(ctx, 'digit_' + n, x, y, scale || 1);
    return 5 * (scale || 1); // 4 px + 1 gap, at 1x (caller multiplies if needed)
  }

  function drawNumber(ctx, num, x, y, scale, pad) {
    scale = scale || 1;
    var s = String(Math.max(0, num | 0));
    while (s.length < (pad || 0)) s = '0' + s;
    var dx = x;
    for (var i = 0; i < s.length; i++) {
      blit(ctx, 'digit_' + s.charAt(i), dx, y, scale);
      dx += 5 * scale;
    }
    return dx - x;
  }

  function drawSmallNumber(ctx, num, x, y, scale, pad) {
    scale = scale || 1;
    var s = String(Math.max(0, num | 0));
    while (s.length < (pad || 0)) s = '0' + s;
    var dx = x;
    for (var i = 0; i < s.length; i++) {
      blit(ctx, 'sdigit_' + s.charAt(i), dx, y, scale);
      dx += 4 * scale;
    }
    return dx - x;
  }

  function drawText(ctx, text, x, y, scale) {
    scale = scale || 1;
    var dx = x;
    text = String(text || '').toUpperCase();
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === ' ') { dx += 4 * scale; continue; }
      var name = 'letter_' + ch;
      if (!ITEMS[name]) continue;
      blit(ctx, name, dx, y, scale);
      dx += (ITEMS[name].w + 1) * scale;
    }
    return dx - x;
  }

  function drawHearts(ctx, x, y, filled, max, scale) {
    scale = scale || 1;
    max = max || 4;
    for (var i = 0; i < max; i++) {
      blit(ctx, i < filled ? 'heart' : 'heart_empty', x + i * 9 * scale, y, scale);
    }
  }

  var ICON_ORDER_TOP = ['STATUS', 'FEED', 'TRAIN', 'BATTLE'];
  var ICON_ORDER_BOT = ['FLUSH', 'LIGHT', 'MEDIC', 'CALL'];
  var SELECTABLE = ['STATUS', 'FEED', 'TRAIN', 'BATTLE', 'FLUSH', 'LIGHT', 'MEDIC'];

  var EGG_PICKER = [
    { id: 'egg_v1', dataEgg: '1', label: '版本一數碼蛋' },
    { id: 'egg_v2', dataEgg: '2', label: '版本二數碼蛋' },
    { id: 'egg_v3', dataEgg: '3', label: '版本三數碼蛋' },
    { id: 'egg_v4', dataEgg: '4', label: '版本四數碼蛋' },
    { id: 'egg_v5', dataEgg: '5', label: '版本五數碼蛋' },
    { id: 'egg_zuba', dataEgg: 'zuba', label: '茲巴數碼蛋' },
    { id: 'egg_hack', dataEgg: 'hack', label: '哈克數碼蛋' },
    { id: 'egg_dra_blue', dataEgg: 'dra_blue', label: '龍仔獸藍蛋' },
    { id: 'egg_dra_green', dataEgg: 'dra_green', label: '龍仔獸綠蛋' },
    { id: 'egg_doru', dataEgg: 'doru', label: '多路數碼蛋' },
    { id: 'egg_anime_agumon', dataEgg: 'anime_agumon', label: '動畫亞古獸數碼蛋' },
    { id: 'egg_anime_gabumon', dataEgg: 'anime_gabumon', label: '動畫加布獸數碼蛋' },
    { id: 'egg_corona', dataEgg: 'corona', label: '日冕數碼蛋' },
    { id: 'egg_luna', dataEgg: 'luna', label: '露娜數碼蛋' },
    { id: 'egg_meicoo', dataEgg: 'meicoo', label: '梅可可數碼蛋' }
  ];

  var api = {
    ITEMS: ITEMS,
    RAW_SYMBOLS: RAW_SYMBOLS,
    RAW_DIGITS: RAW_DIGITS,
    RAW_SMALL: RAW_SMALL,
    RAW_LETTERS: RAW_LETTERS,
    RAW_RECON: RAW_RECON,
    ICON_ORDER_TOP: ICON_ORDER_TOP,
    ICON_ORDER_BOT: ICON_ORDER_BOT,
    SELECTABLE: SELECTABLE,
    EGG_PICKER: EGG_PICKER,
    render: render,
    blit: blit,
    drawDigit: drawDigit,
    drawNumber: drawNumber,
    drawSmallNumber: drawSmallNumber,
    drawText: drawText,
    drawHearts: drawHearts,
    bitGrid: bitGrid
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VpetItems = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
