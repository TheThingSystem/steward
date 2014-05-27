var voiceEntries = {};

var showVoiceSettings = function() {
  var cats, cat, chart, div, div2, i, img, trayTop;
  
  chart = document.getElementById('chart');
  while (chart.lastChild) chart.removeChild(chart.lastChild);
  chart.style.backgroundImage = 'url(popovers/assets/thing.bkg.voice.svg)';

  div = document.createElement('div');
  div.setAttribute('style', 'position: absolute; top: 20px; left: 20px; margin-bottom: 8px; width: 44px; height: 44px; background-color: #fff;');
  img = document.createElement('img');
  img.setAttribute('id', 'gobackButton');
  img.setAttribute('src', 'actors/home.svg');
  img.setAttribute('onclick', 'javascript: goback();');
  div.appendChild(img);
  chart.appendChild(div);
  
  div = document.createElement('div');
  div.setAttribute('id', 'voice-instructions-1');
  div.setAttribute('class', 'voice-instructions-1');
  div.innerHTML = 'Voice Commands';
  div2 = document.createElement('div');
  div2.setAttribute('class', 'multiple-voice-instructions');
  div2.innerHTML = 'Touch a category to edit &#8594;';
  div.appendChild(div2);
  chart.appendChild(div);
  
  for (i = 0; i < voiceUtils.categories.length; i++) {
    cat = voiceUtils.categories[i];
		img = document.createElement('img');
		img.setAttribute('src', cat.img);
		img.setAttribute('id', cat.name + '-voice');
		img.setAttribute('title', cat.name);
		img.setAttribute('class', 'voice-category' + (i+1));
		img.setAttribute('onclick', 'javascript:voiceUtils.selectCategory(' + i + ');');
		img.style.opacity = (cat.active) ? 1.0 : 0.3;
		chart.appendChild(img);
  }
  
  voiceUtils.loadPositions();
  voiceUtils.findActiveCategories();
  
};

var exportVoiceCommands = function() {
    var a, actor, actors, cdate, edate, entry, fn, g, groupID, grousp, i, ifrm, pair, pairs, part0, part1, part2, part3, partC, partN, q, q24, quad, taskID,
        tasks, url, vocalia;
    
    if (!voiceEntries.recognizer) {
      document.getElementById('voice-instructions-3').style.color = '#f00';
      return;
    }
    
    actors = voiceEntries.actors;
    groups = voiceEntries.groups;
    tasks = voiceEntries.tasks;

    pairs = {};

    cdate = new Date().getTime();
    edate = cdate + (30 * 86400 * 1000);
    var profile = function(id, mid, nme) {/* jshint multistr: true */
      part1 += '\
	<Profile sr="prof' + id + '" ve="2">\n\
		<cdate>' + cdate + '</cdate>\n\
		<edate>' + edate + '</edate>\n\
		<flags>2</flags>\n\
		<id>' + id + '</id>\n\
		<mid0>' + mid + '</mid0>\n\
		<nme>' + nme + '</nme>\n\
		<State sr="con0">\n\
			<code>20126</code>\n\
			<Bundle sr="arg0">\n\
				<Vals sr="val">\n\
					<Contains>false</Contains>\n\
					<Contains-type>java.lang.Boolean</Contains-type>\n\
					<DisableCommand>&lt;null&gt;</DisableCommand>\n\
					<DisableCommand-type>java.lang.String</DisableCommand-type>\n\
					<DisableCommandExact>false</DisableCommandExact>\n\
					<DisableCommandExact-type>java.lang.Boolean</DisableCommandExact-type>\n\
					<DisableCommandRegex>false</DisableCommandRegex>\n\
					<DisableCommandRegex-type>java.lang.Boolean</DisableCommandRegex-type>\n\
					<LastCommandIdInvert>false</LastCommandIdInvert>\n\
					<LastCommandIdInvert-type>java.lang.Boolean</LastCommandIdInvert-type>\n\
					<LastCommandIdRegex>false</LastCommandIdRegex>\n\
					<LastCommandIdRegex-type>java.lang.Boolean</LastCommandIdRegex-type>\n\
					<NotOnContinuous>false</NotOnContinuous>\n\
					<NotOnContinuous-type>java.lang.Boolean</NotOnContinuous-type>\n\
					<NotOnNormal>false</NotOnNormal>\n\
					<NotOnNormal-type>java.lang.Boolean</NotOnNormal-type>\n\
					<Precision>&lt;null&gt;</Precision>\n\
					<Precision-type>java.lang.String</Precision-type>\n\
					<ProfileName>&lt;null&gt;</ProfileName>\n\
					<ProfileName-type>java.lang.String</ProfileName-type>\n\
					<Substitutions>&lt;null&gt;</Substitutions>\n\
					<Substitutions-type>java.lang.String</Substitutions-type>\n\
					<TriggerWord>&lt;null&gt;</TriggerWord>\n\
					<TriggerWord-type>java.lang.String</TriggerWord-type>\n\
					<TriggerWordExact>false</TriggerWordExact>\n\
					<TriggerWordExact-type>java.lang.Boolean</TriggerWordExact-type>\n\
					<TriggerWordRegex>false</TriggerWordRegex>\n\
					<TriggerWordRegex-type>java.lang.Boolean</TriggerWordRegex-type>\n\
					<com.twofortyfouram.locale.intent.extra.BLURB>Event Behaviour: true\n\
Command: "' + nme.toLowerCase() + '"</com.twofortyfouram.locale.intent.extra.BLURB>\n\
					<com.twofortyfouram.locale.intent.extra.BLURB-type>java.lang.String</com.twofortyfouram.locale.intent.extra.BLURB-type>\n\
					<configcommand>' + nme.toLowerCase() + '</configcommand>\n\
					<configcommand-type>java.lang.String</configcommand-type>\n\
					<configcommandid>&lt;null&gt;</configcommandid>\n\
					<configcommandid-type>java.lang.String</configcommandid-type>\n\
					<configcommandinvert>false</configcommandinvert>\n\
					<configcommandinvert-type>java.lang.Boolean</configcommandinvert-type>\n\
					<configexactsub>false</configexactsub>\n\
					<configexactsub-type>java.lang.Boolean</configexactsub-type>\n\
					<configinstant>true</configinstant>\n\
					<configinstant-type>java.lang.Boolean</configinstant-type>\n\
					<configlastcommand>&lt;null&gt;</configlastcommand>\n\
					<configlastcommand-type>java.lang.String</configlastcommand-type>\n\
					<configregexsub>false</configregexsub>\n\
					<configregexsub-type>java.lang.Boolean</configregexsub-type>\n\
					<net.dinglisch.android.tasker.RELEVANT_VARIABLES>&lt;StringArray sr=""&gt;&lt;_array_net.dinglisch.android.tasker.RELEVANT_VARIABLES0&gt;%avcommnofilter\n\
First Command Without Filter\n\
&lt;/_array_net.dinglisch.android.tasker.RELEVANT_VARIABLES0&gt;&lt;_array_net.dinglisch.android.tasker.RELEVANT_VARIABLES1&gt;%avsource\n\
Source of the Voice Command. Can be normal, continuous, test or googlenow\n\
&lt;/_array_net.dinglisch.android.tasker.RELEVANT_VARIABLES1&gt;&lt;_array_net.dinglisch.android.tasker.RELEVANT_VARIABLES2&gt;%avword()\n\
Word Array\n\
&lt;/_array_net.dinglisch.android.tasker.RELEVANT_VARIABLES2&gt;&lt;_array_net.dinglisch.android.tasker.RELEVANT_VARIABLES3&gt;%avcomm\n\
First recognized Command\n\
&lt;/_array_net.dinglisch.android.tasker.RELEVANT_VARIABLES3&gt;&lt;_array_net.dinglisch.android.tasker.RELEVANT_VARIABLES4&gt;%avcomms()\n\
All recognized commands\n\
&lt;/_array_net.dinglisch.android.tasker.RELEVANT_VARIABLES4&gt;&lt;_array_net.dinglisch.android.tasker.RELEVANT_VARIABLES5&gt;%avcommsnofilter()\n\
All recognized commands without filter\n\
&lt;/_array_net.dinglisch.android.tasker.RELEVANT_VARIABLES5&gt;&lt;/StringArray&gt;</net.dinglisch.android.tasker.RELEVANT_VARIABLES>\n\
					<net.dinglisch.android.tasker.RELEVANT_VARIABLES-type>[Ljava.lang.String;</net.dinglisch.android.tasker.RELEVANT_VARIABLES-type>\n\
					<net.dinglisch.android.tasker.extras.VARIABLE_REPLACE_KEYS>plugininstanceid plugintypeid configcommand configcommandid configlastcommand Precision DisableCommand TriggerWord ProfileName Substitutions </net.dinglisch.android.tasker.extras.VARIABLE_REPLACE_KEYS>\n\
					<net.dinglisch.android.tasker.extras.VARIABLE_REPLACE_KEYS-type>java.lang.String</net.dinglisch.android.tasker.extras.VARIABLE_REPLACE_KEYS-type>\n\
					<net.dinglisch.android.tasker.subbundled>true</net.dinglisch.android.tasker.subbundled>\n\
					<net.dinglisch.android.tasker.subbundled-type>java.lang.Boolean</net.dinglisch.android.tasker.subbundled-type>\n\
					<plugininstanceid>20cdd5e8-fb2d-4cf0-a2da-468e7c91339c</plugininstanceid>\n\
					<plugininstanceid-type>java.lang.String</plugininstanceid-type>\n\
					<plugintypeid>com.joaomgcd.autovoice.intent.IntentReceiveVoice</plugintypeid>\n\
					<plugintypeid-type>java.lang.String</plugintypeid-type>\n\
				</Vals>\n\
			</Bundle>\n\
			<Str sr="arg1" ve="3">com.joaomgcd.autovoice</Str>\n\
			<Str sr="arg2" ve="3">AutoVoice Recognized</Str>\n\
		</State>\n\
	</Profile>\n';

        pairs[mid] = { command: nme };
    };

    var task = function(id, nme, a1, a2) {/* jshint multistr: true */
     var j, kv, s;

      part2 += '\
	<Task sr="task' + id + '">\n\
		<cdate>' + cdate + '</cdate>\n\
		<edate>' + edate + '</edate>\n\
		<id>' + id + '</id>\n\
		<nme>' + nme + '</nme>\n\
		<Action sr="act0" ve="3">\n\
			<code>548</code>\n\
			<Str sr="arg0" ve="3">%avcomm</Str>\n\
			<Int sr="arg1" val="0"/>\n\
		</Action>\n\
		<Action sr="act1" ve="3">\n\
			<code>118</code>\n\
			<Str sr="arg0" ve="3">%Steward</Str>\n\
			<Str sr="arg1" ve="3">/oneshot</Str>\n\
			<Str sr="arg2" ve="3">' + a1.join('\n') + '</Str>\n\
			<Str sr="arg3" ve="3"/>\n\
			<Int sr="arg4" val="10"/>\n\
			<Str sr="arg5" ve="3"/>\n\
			<Str sr="arg6" ve="3"/>\n\
		</Action>\n';
        if (!!a2)
          part2 += '\n\
		<Action sr="act2" ve="3">\n\
			<code>559</code>\n\
			<Str sr="arg0" ve="3">%HTTPD</Str>\n\
			<Str sr="arg1" ve="3">default:default</Str>\n\
			<Int sr="arg2" val="3"/>\n\
			<Int sr="arg3" val="5"/>\n\
			<Int sr="arg4" val="5"/>\n\
			<Int sr="arg5" val="1"/>\n\
			<Int sr="arg6" val="0"/>\n\
		</Action>';
        part2 += '\n\
	</Task>\n';

       if (!!a2) return;
       pairs[id].task = 'command://' + window.location.hostname + ':' + window.location.port + '/oneshot';
       for (j = 0, s = '?'; j < a1.length; j++, s = '&') {
         kv = a1[j].split('=');
         pairs[id].task += s + kv[0] + '=' + encodeURIComponent(kv[1]);
       }
    };


    var f = function(q) {
      var lighting =             function(entry) { if (entry.phrases['report'].selected) 
                                                     report(entry.entry,  [ 'status'                                  ], entry.phrases['report'].text);
                                                   if (entry.phrases['on'].selected) 
                                                     perform(entry.entry, entry.phrases['on'].text,  'on');
                                                   if (entry.phrases['off'].selected)
                                                     perform(entry.entry, entry.phrases['off'].text, 'off');                      };

      return { climate_control : function(entry) { if (entry.phrases['report'].selected) 
                                                     report(entry.entry,  [ 'temperature', 'humidity'                                ], entry.phrases['report'].text);              }
             , climate_plant   : function(entry) { if (entry.phrases['report'].selected) 
                                                     report(entry.entry,  [ 'status', 'needsWater', 'needsMist', 'needsFertilizer'   ], entry.phrases['report'].text);              }
             , climate_soil    : function(entry) { if (entry.phrases['report'].selected) 
                                                     report(entry.entry,  [ 'temperature', 'moisture', 'waterVolume', 'light'        ], entry.phrases['report'].text);              }
             , climate_meteo   : function(entry) { if (entry.phrases['report'].selected) 
                                                     report(entry.entry,  [ 'temperature', 'humidity', 'noise', 'co2' , 'rainRate', 'rainTotal', 
						                            'windAverage', 'windGust','windDirection'                ], entry.phrases['report'].text);              }

             , lighting_bulb       : lighting
             , lighting_downlight  : lighting
             , lighting_lightstrip : lighting
             , lighting_uplight    : lighting
             , lighting_rgb    : function(entry) { if (entry.phrases['program'].selected) 
                                                     perform(entry.entry, entry.phrases['program'].text, 'program', { pattern: 'spiral' });
                                                   if (entry.phrases['off'].selected) 
                                                     perform(entry.entry, entry.phrases['off'].text, 'off');                              }
             , motive_lock     : function(entry) { if (entry.phrases['report'].selected) 
                                                     report(entry.entry,  [ 'status'                                  ], entry.phrases['report'].text);
                                                   if (entry.phrases['lock'].selected) 
                                                     perform(entry.entry, entry.phrases['lock'].text, 'lock');
                                                   if (entry.phrases['unlock'].selected) 
                                                     perform(entry.entry, entry.phrases['unlock'].text, 'unlock');                           }
             , 'motive_model-s': function(entry) { if (entry.phrases['report'].selected) 
                                                     report(entry.entry,  [ 'physical'                                ], entry.phrases['report'].text);            }
             , motive_vehicle  : function(entry) { if (entry.phrases['report'].selected) 
                                                     report(entry.entry,  [ 'physical'                                ], entry.phrases['report'].text);            }
             , media_video     : function(entry) { if (entry.phrases['play'].selected) 
                                                     perform(entry.entry, entry.phrases['play'].text, 'play',
                                                           { url: 'https://www.youtube.com/watch?v=E9SbCeFcMPI' });
                                                   if (entry.phrases['pause'].selected) 
                                                     perform(entry.entry, entry.phrases['pause'].text,  'pause' );
                                                   if (entry.phrases['resume'].selected) 
                                                     perform(entry.entry, entry.phrases['resume'].text,  'resume');                          }
             , sensor_co       : function(entry) { if (entry.phrases['report'].selected) 
                                                     report(entry.entry,  [ 'co'                                      ], entry.phrases['report'].text);              }
             , sensor_co2      : function(entry) { if (entry.phrases['report'].selected) 
                                                     report(entry.entry,  [ 'co2'                                     ], entry.phrases['report'].text);              }
             , sensor_no2      : function(entry) { if (entry.phrases['report'].selected) 
                                                     report(entry.entry,  [ 'no2'                                     ], entry.phrases['report'].text);              }
             , sensor_smoke    : function(entry) { if (entry.phrases['report'].selected) 
                                                     report(entry.entry,  [ 'smoke', 'co'                             ], entry.phrases['report'].text);              }
             , switch_onoff    : function(entry) { if (entry.phrases['report'].selected) 
                                                     report(entry.entry,  [ 'status'                                  ]);
                                                   if (entry.phrases['on'].selected) 
                                                     perform(entry.entry, entry.phrases['on'].text, 'on');
                                                   if (entry.phrases['off'].selected) 
                                                     perform(entry.entry, entry.phrases['off'].text, 'off');                       }
             }[q];
    };

    var perform = function(entry, text, perform, parameters) {
      partN++;
      profile(partN, partN + 1, text);
      partN++;
      task(partN, text,
           [ 'behavior=perform'
           , 'entity=device'
           , 'id=' + entry.whoami.split('/')[1]
           , 'perform=' + perform
           , 'parameter=' + JSON.stringify(parameters || {})
           ]);
    };

    var report = function(entry, params, title) {
      if (!title) title = 'tell me about ' + entry.name;
      partN++;
      profile(partN, partN + 1, title);
      partN++;
      task(partN, title,
           [ 'behavior=report'
           , 'entity=device'
           , 'id=' + entry.whoami.split('/')[1]
           , 'properties=' + params.join(',')
           ], true);
    };


    partN = 0;
    part1 = '';
    part2 = '';
    q24 = {};
    for (i = 0; i < voiceEntries.devices.length; i++ ) {
      entry = voiceEntries.devices[i];
      if (!entry.phrases) continue;
      g = f(entry.q);
      if (!!g) g(entry);
    }


    var h = function(q) {
      return { climate_plant  : function(entry) { if (entry.phrases['report'].selected) 
                                                     report2(entry.phrases['report'].text,  '/device/climate/koubachi/plant',
                                                           [ 'status', 'needsWater', 'needsMist', 'needsFertilizer' ]);              }
             , lighting_bulb  : function(entry) { if (entry.phrases['report'].selected) 
                                                     report2(entry.phrases['report'].text,  '/device/lighting',
                                                           [ 'status' ]);
                                                  if (entry.phrases['on'].selected) 
                                                     perform2(entry.phrases['on'].text,     '/device/lighting',                'on' );
                                                  if (entry.phrases['off'].selected) 
                                                     perform2(entry.phrases['off'].text,    '/device/lighting',                'off');        }
             , motive_lock    : function(entry) { if (entry.phrases['report'].selected) 
                                                     report2(entry.phrases['report'].text,  '/device/motive/lockitron/lock',
                                                           [ 'status' ]);
                                                  if (entry.phrases['lock'].selected) 
                                                     perform2(entry.phrases['lock'].text,   '/device/motive/lockitron/lock',   'lock' );
                                                  if (entry.phrases['unlock'].selected) 
                                                     perform2(entry.phrases['unlock'].text, '/device/motive/lockitron/lock',   'unlock' );    }
             , sensor_smoke   : function(entry) { if (entry.phrases['report'].selected) 
                                                     report2(entry.phrases['report'].text,  '/device/sensor',
                                                           [ 'smoke', 'co', 'co2', 'no', 'no2', 'voc' ]);                            }
             , switch_onoff   : function(entry) { if (entry.phrases['report'].selected) 
                                                     report2(entry.phrases['report'].text,  '/device/switch',
                                                           [ 'status' ]);
                                                  if (entry.phrases['on'].selected) 
                                                     perform2(entry.phrases['on'].text,     '/device/switch',                  'on' );
                                                  if (entry.phrases['off'].selected) 
                                                     perform2(entry.phrases['off'].text,    '/device/switch',                  'off');        }
             }[q];
    };

    var perform2 = function(text, prefix, perform, parameters) {
      partN++;
      profile(partN, partN + 1, text);
      partN++;
      task(partN, text,
           [ 'behavior=perform'
           , 'entity=actor'
           , 'prefix=' + prefix
           , 'perform=' + perform
           , 'parameter=' + JSON.stringify(parameters || {})
           ]);
    };

    var report2 = function(text, prefix, params) {
      partN++;
      profile(partN, partN + 1, text);
      partN++;
      task(partN, text,
           [ 'behavior=report'
           , 'entity=actor'
           , 'prefix=' + prefix
           , 'properties=' + params.join(',')
           ], true);
    };

    for (i = 0; i < voiceEntries.categories.length; i++) {
      entry = voiceEntries.categories[i];
      if (!entry.phrases) continue;
      g = h(entry.q);
      if (!!g) g(entry);
    }

    var perform3 = function(groupID, text) {
      partN++;
      profile(partN, partN + 1, text);
      partN++;
      task(partN, text,
           [ 'behavior=perform'
           , 'entity=group'
           , 'id=' + groupID
           ]);
    };

    for (i = 0; i < voiceEntries.groups.length; i++) {
      entry = voiceEntries.groups[i];
      if (entry.phrases['perform'].selected === true && entry.entry.type === 'task') perform3(entry.entry.uuid, entry.phrases['perform'].text);
    }

    var perform4 = function(taskID, text) {
      partN++;
      profile(partN, partN + 1, text);
      partN++;
      task(partN, text,
           [ 'behavior=perform'
           , 'entity=task'
           , 'id=' + taskID
           ]);
    };

    for (i = 0; i < voiceEntries.tasks.length; i++) {
      entry = voiceEntries.tasks[i];
      if (entry.phrases['perform'].selected === true) perform4(entry.entry.uuid, entry.phrases['perform'].text);
    }


    if (voiceEntries.recognizer === "tasker") {
      fn = 'userbackup.xml';

      part0 = '<TaskerData sr="" dvi="1" tv="4.2u3m">\n';
      part3 = '</TaskerData>\n';
    } else {/* jshint multistr: true */
      fn = 'commands.html';

      part0 = '';
      part1 = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n\
	<HTML>\n\
	<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n\
	<Title>Bookmarks</Title>\n\
	<H1>Bookmarks</H1>\n\
\n\
	<DT><H3 FOLDED>Commands</H3>\n\
	<DL><p>\n\
\n\
\n';
      part2 = '';
      part3 = '	</DL>\n\
</HTML>\n\
\n';

      for (pair in pairs) {
        if ((!pairs.hasOwnProperty(pair)) || (!pairs[pair].task)) continue;

        part1 += '<DT><A HREF="' + pairs[pair].task + '">' + pairs[pair].command + '</A>\n';
      }
    }
    
    partC = '<!-- Save this page as "' + fn + '" -->\n';

    a = window.document.createElement('a');
    if (a.hasOwnProperty('download')) {
      a.download = fn;
      url = window.URL.createObjectURL(new Blob([part0 + part1 + part2 + part3], { type: 'text/plain' }));
      a.href = url
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      url = window.URL.createObjectURL(new Blob([partC + part0 + part1 + part2 + part3], { type: 'text/plain' }));
      window.open(url, '_blank');
    }
    window.URL.revokeObjectURL(url);
};


var voiceUtils = {
  categories : [ {name: 'motive'
                   , img: 'popovers/assets/actors/motive-vehicle.svg'
                   , active: false
                   , q: ['motive_model-s', 'motive_vehicle']
                   , top: 0
                   , left: 0}
                 , {name: 'climate'
                   , img: 'popovers/assets/actors/sensor-climate.svg'
                   , active: false
                   , q: ['climate_control', 'climate_plant', 'climate_soil', 'climate_meteo']
                   , top: 0
                   , left: 0}
                 , {name: 'lighting'
                   , img: 'popovers/assets/actors/lighting-downlight.svg'
                   , active: false
                   , q: ['lighting_bulb', 'lighting_downlight', 'lighting_lightstrip', 'lighting_uplight', 'lighting_rgb']
                   , top: 0
                   , left: 0}
                 , {name: 'motive-lock'
                   , img: 'popovers/assets/actors/motive-lock.svg'
                   , active: false
                   , q: ['motive_lock']
                   , top: 0
                   , left: 0}
                 , {name: 'media'
                   , img: 'popovers/assets/actors/media-video.svg'
                   , active: false
                   , q: ['media_video']
                   , top: 0
                   , left: 0}
                 , {name: 'sensor'
                   , img: 'popovers/assets/actors/sensor-generic.svg'
                   , active: false
                   , q: ['sensor_co', 'sensor_co2', 'sensor_no2', 'sensor_smoke']
                   , top: 0
                   , left: 0}
                 , {name: 'switch'
                   , img: 'popovers/assets/actors/switch-onoff.svg'
                   , active: false
                   , q: ['switch_onoff']
                   , top: 0
                   , left: 0}
                 , {name: 'groups'
                   , img: 'categories/groups.svg'
                   , active: true
                   , top: 0
                   , left: 0}
                 , {name: 'tasks'
                   , img: 'categories/tasks.svg'
                   , active: true
                   , top: 0
                   , left: 0}
               ],
  findCategory : function(q) {
      return { climate_control  : 'climate'
             , climate_plant    : 'climate'
             , climate_soil     : 'climate'
             , climate_meteo    : 'climate'
             , lighting_bulb       : 'lighting'
             , lighting_downlight  : 'lighting'
             , lighting_lightstrip : 'lighting'
             , lighting_uplight    : 'lighting'
             , lighting_rgb        : 'lighting'
             , motive_lock      : 'motive-lock'
             , 'motive_model-s' : 'motive'
             , motive_vehicle   : 'motive'
             , media_video      : 'media'
             , sensor_co        : 'sensor'
             , sensor_co2       : 'sensor'
             , sensor_no2       : 'sensor'
             , sensor_smoke     : 'sensor'
             , switch_onoff     : 'switch'
             }[q];
  },
  defaultDevicePhrases : function(entry, q) {
      var lighting =             { on : { text: 'turn ' + entry.name + ' on', selected: true }
                                 , off : { text: 'turn ' + entry.name + ' off', selected: true }
                                 , report: { text: 'tell me about ' + entry.name, selected: true } };

      return { climate_control : { report: { text: 'tell me about ' + entry.name, selected: true } }            
             , climate_plant   : { report: { text: 'tell me about ' + entry.name, selected: true } } 
             , climate_soil    : { report: { text: 'tell me about ' + entry.name, selected: true } } 
             , climate_meteo   : { report: { text: 'tell me about ' + entry.name, selected: true } }
             , lighting_bulb       : lighting
             , lighting_downlight  : lighting
             , lighting_lightstrip : lighting
             , lighting_uplight    : lighting
             , lighting_rgb    : { program : { text: entry.name + ' dazzle', selected: true }
                                 , off : { text: entry.name + ' enough' , selected: true }  }
             , motive_lock     : { lock : { text: 'lock ' + entry.name, selected: true }
                                 , unlock : { text: 'unlock ' + entry.name, selected: true }
                                 , report: { text: 'tell me about ' + entry.name, selected: true } }  
             , 'motive_model-s': { report: { text: 'tell me about ' + entry.name, selected: true } } 
             , motive_vehicle  : { report: { text: 'tell me about ' + entry.name, selected: true } } 
             , media_video     : { play : { text: 'youtube ' + entry.name, selected: true }
                                 , pause : { text: 'pause ' + entry.name, selected: true }
                                 , resume: { text: 'resume ' + entry.name, selected: true }}
             , sensor_co       : { report: { text: 'tell me about ' + entry.name, selected: true } }
             , sensor_co2      : { report: { text: 'tell me about ' + entry.name, selected: true } }
             , sensor_no2      : { report: { text: 'tell me about ' + entry.name, selected: true } }
             , sensor_smoke    : { report: { text: 'tell me about ' + entry.name, selected: true } }
             , switch_onoff    : { on : { text: 'turn ' + entry.name + ' on', selected: true }
                                 , off : { text: 'turn ' + entry.name + ' off', selected: true }
                                 , report: { text: 'tell me about ' + entry.name, selected: true } } 
             }[q];
  },
  defaultCategoryPhrases : function(entry, q) {
      return { climate_plant   : { report: { text: 'tell me about plants', selected: true } } 
             , lighting_bulb   : { on : { text: 'turn lights on', selected: true }
                                 , off : { text: 'turn lights off', selected: true }
                                 , report: { text: 'tell me about lights', selected: true } }
             , motive_lock     : { lock : { text: 'lock everything', selected: true }
                                 , unlock : { text: 'unlock everything', selected: true }
                                 , report: { text: 'tell me about locks', selected: true } }  
             , sensor_smoke    : { report: { text: 'tell me about air quality', selected: true } }
             , switch_onoff    : { on : { text: 'turn power on', selected: true }
                                 , off : { text: 'turn power off', selected: true }
                                 , report: { text: 'tell me about power', selected: true } } 
             }[q];
  },
             
  selectCategory : function(n) {
    var cat, elem;
    cat = this.categories[n];
    
    if (cat.active) {
      showCategoryChoices(cat);
    
      this.deselectAll();
      elem = d3.select('#' + cat.name + '-voice');
      elem.transition()
        .duration(700)
        .ease('bounce')
      .style({
        height: '88px',
        width: '88px',
        left: function() { return (cat.left - 22) + 'px'; },
        top: function() { return (cat.top - 22) + 'px'; }
      });
    }
    
    function showCategoryChoices(cat) {
      var chart, cluster, div, div2, div3, entries, entry, i, id, img, input, phrase, rowCount, span, table, td, tr, tray;
      chart = document.getElementById('chart');
      chart.style.backgroundImage = 'url(popovers/assets/thing.bkg.voice.enumerate.svg)';
      if (document.getElementById('voice-instructions-1')) chart.removeChild(document.getElementById('voice-instructions-1'));
      if (document.getElementById('voice-instructions-3')) voiceUtils.removeRecognizers();
      
      if (!document.getElementById('voice-instructions-2')) {
				div = document.createElement('div');
				div.setAttribute('id', 'voice-instructions-2');
				div.setAttribute('class', 'voice-instructions-2');
				div.innerHTML = 'Edit <span id="instructions-cat">' + cat.name + '</span> Voice Commands';
				chart.appendChild(div);
				
				div2 = document.createElement('div');
				div2.setAttribute('id', 'enumerations-viewport');
				div2.setAttribute('class', 'enumerations-viewport');
				div2.setAttribute('style', 'height: 360px');
				div.appendChild(div2);
				
				table = d3.select('#enumerations-viewport')
				  .append('table')
				  .attr('id', 'enumerations-tray')
				  .style('top', '0px');
				
				div = document.createElement('div');
				div.setAttribute('id', 'voice-slider');
				div.setAttribute('class', 'voice-slider');
				div2 = document.createElement('div');
				div2.setAttribute('style', 'position: absolute; top: 10px; left: 2px');
				img = document.createElement('img');
				img.setAttribute('id', 'phrase-up-arrow');
				img.setAttribute('style', 'display: none');
				img.setAttribute('onclick', 'javascript:handlePhraseArrow(event)');
				img.setAttribute('src', 'popovers/assets/arrow-up.svg');
				div2.appendChild(img);
				div.appendChild(div2);
				div2 = document.createElement('div');
				div2.setAttribute('style', 'position: absolute; bottom: 16px; left: 3px');
				img = document.createElement('img');
				img.setAttribute('id', 'phrase-down-arrow');
				img.setAttribute('style', 'display: none');
				img.setAttribute('onclick', 'javascript:handlePhraseArrow(event)');
				img.setAttribute('src', 'popovers/assets/arrow-down.svg');
				div2.appendChild(img);
				div.appendChild(div2);
				chart.appendChild(div);
				
				img = document.createElement('img');
				img.setAttribute('id', 'download-interstitial');
				img.setAttribute('class', 'download-interstitial');
				img.setAttribute('src', 'popovers/assets/download.interstitial.svg');
				img.setAttribute('onclick', 'javascript:voiceUtils.showRecognizers()');
				chart.appendChild(img);
      } else {
        document.getElementById('instructions-cat').innerHTML = cat.name;
      }
      
      if (document.getElementById('enumerations-tray')) {
        table = document.getElementById('enumerations-tray');
        clearTray(table);
        rowCount = 0;
        entries = getCatEntries(cat);
        
        for (i = 0; i < entries.length; i++) {
          entry = entries[i];
          cluster = (cat.name === 'tasks' || cat.name === 'groups') ? cat.name : ((entry.sort === '!!!') ? 'categories' : 'devices');
          for (phrase in entry.phrases) {
            id = { devices : entry.entry.whoami, categories : entry.q, groups : entry.entry.uuid, tasks : entry.entry.uuid }[cluster]; //(cluster === 'tasks' || cluster === 'groups') ? (cluster === 'categories') ? entry.q : entry.entry.whoami;
            tr = document.createElement('tr');
            tr.setAttribute('class', 'enumeration-row');
            td = document.createElement('td');
            td.setAttribute('class', 'enumeration-checkbox');
            input = document.createElement('input');
            input.setAttribute('id', 'voicebox' + ++rowCount);
            input.setAttribute('class', 'voice-checkbox');
            input.setAttribute('type', 'checkbox');
            input.setAttribute('checked', entry.phrases[phrase].selected);
            input.setAttribute('onclick', 'javascript:voiceUtils.setPhraseSelected("' + cluster + '", "' + id + '", "' + phrase + '", event)');
            td.appendChild(input);
            tr.appendChild(td);
            td = document.createElement('td');
            span = document.createElement('span');
            span.setAttribute('style', 'position:relative, width: 370px;');
            span.setAttribute('id', 'enumeration' + rowCount);
            span.setAttribute('class', 'enumeration-edit');
            span.setAttribute('contenteditable', 'true');
            span.textContent = entry.phrases[phrase].text;
            span.setAttribute('onblur', 'javascript:voiceUtils.setPhraseText("' + cluster + '", "' + id + '", "' + phrase + '", event)');
            span.setAttribute('onkeydown', 'javascript:voiceUtils.setPhraseText("' + cluster + '", "' + id + '", "' + phrase + '", event)');
            td.appendChild(span);
            tr.appendChild(td);
            table.appendChild(tr);
            document.getElementById("voicebox" + rowCount).checked = entry.phrases[phrase].selected;
          }
        }
        if (parseInt(getComputedStyle(document.getElementById('enumerations-tray')).height, 10) > 
            parseInt(getComputedStyle(document.getElementById('enumerations-viewport')).height, 10)) {
          document.getElementById("phrase-down-arrow").style.display = "block";
        } else document.getElementById("phrase-down-arrow").style.display = "none";
      }
      
      function deviceNumber(whoami) {
        return whoami.split('/')[1];
      }
      
      function clearTray(tray) {
          while (tray.lastChild) tray.removeChild(tray.lastChild);
          tray.style.top = '0px';
          document.getElementById("phrase-down-arrow").style.display = "none";
          document.getElementById("phrase-up-arrow").style.display = "none";
      }
      function getCatEntries(cat) {
        var device, entries, i;
        entries = [];
        for (i = 0; i < voiceEntries.devices.length; i++) {
          device = voiceEntries.devices[i];
          if (device.category === cat.name && !!device.phrases) {
            entries.push(device);
          }
        }
        for (i = 0; i < voiceEntries.categories.length; i++) {
          device = voiceEntries.categories[i];
          if (device.category === cat.name && !!device.phrases) {
            entries.push(device);
          }
        }
        for (i = 0; i < voiceEntries.groups.length; i++) {
          device = voiceEntries.groups[i];
          if (device.category === cat.name && !!device.phrases) {
            entries.push(device);
          }
        }
        for (i = 0; i < voiceEntries.tasks.length; i++) {
          device = voiceEntries.tasks[i];
          if (device.category === cat.name && !!device.phrases) {
            entries.push(device);
          }
        }
        entries.sort(function(a,b) {if (a.sort.toLowerCase() < b.sort.toLowerCase()) return -1;
                                    if (a.sort.toLowerCase() > b.sort.toLowerCase()) return 1;
                                    return 0;});
        return entries;
      }
    }
  },
  deselectAll : function() {
    var cat, cats, elem;
    cats = this.categories;
    for (var i = 0; i < cats.length; i++) {
      cat = cats[i];
      elem = d3.select('#' + cat.name + '-voice');
      elem.transition()
        .duration(200)
      .style({
        height: '44px',
        width: '44px',
        left: (cat.left) + 'px',
        top: (cat.top) + 'px'
      });
    }
  },
  showRecognizers : function() {
    var chart, color_android, color_ios, div, div2, img, span;
    chart = document.getElementById('chart');
    chart.style.backgroundImage = 'url(popovers/assets/thing.bkg.voice.svg)';
    if (document.getElementById('voice-instructions-2')) {
      chart.removeChild(document.getElementById('voice-instructions-2'));
      chart.removeChild(document.getElementById('voice-slider'));
      chart.removeChild(document.getElementById('download-interstitial'));
    }
    
    voiceUtils.deselectAll();
    
    if (!document.getElementById('voice-instructions-3')) {
			div = document.createElement('div');
			div.setAttribute('id', 'voice-instructions-3');
			div.setAttribute('class', 'voice-instructions-3');
			div.innerHTML = 'Please select your Recognizer';
			chart.appendChild(div);
			
			color_android = '#333';
			color_ios = '#333';
			if (!voiceEntries.recognizer) {
			  color_android = (navigator.userAgent.indexOf('Android') >= 0) ? '#f17440' : '#333';
			  color_ios = (navigator.userAgent.indexOf('iOS') >= 0) ? '#f17440' : '#333';
			  voiceEntries.recognizer = (navigator.userAgent.indexOf('Android') >= 0) ?
			      'tasker' : (navigator.userAgent.indexOf('iOS') >= 0) ? 'vocalia' : null;
        voiceUtils.saveVoiceEntries();
      } else {
			  color_android = (voiceEntries.recognizer === 'tasker') ? '#f17440' : '#333';
			  color_ios = (voiceEntries.recognizer === 'vocalia') ? '#f17440' : '#333';
			}
			
			div = document.createElement('div');
			div.setAttribute('id', 'button-panel');
			div.setAttribute('class', 'button-panel');
			div2 = document.createElement('div');
			div2.setAttribute('class', 'recognizer-panel-button');
			div2.setAttribute('id', 'tasker');
			div2.setAttribute('style', 'background-color: ' + color_android);
			div2.setAttribute('onclick', 'javascript: voiceUtils.toggleRecognizerChoice("tasker")');
			img = document.createElement('img');
			img.setAttribute('src', 'popovers/assets/android.svg');
			img.setAttribute('style', 'float: left; padding: 5px 10px 5px 7px;');
			div2.appendChild(img);
			span = document.createElement('span');
			span.setAttribute('style', 'font-size: 18px');
			span.textContent = 'Tasker (Android)';
			div2.appendChild(span);
			div.appendChild(div2);
			div2 = document.createElement('div');
			div2.setAttribute('class', 'recognizer-panel-button');
			div2.setAttribute('id', 'vocalia');
			div2.setAttribute('style', 'margin-top: 11px; background-color: ' + color_ios);
			div2.setAttribute('onclick', 'javascript: voiceUtils.toggleRecognizerChoice("vocalia")');
			img = document.createElement('img');
			img.setAttribute('src', 'popovers/assets/apple.svg');
			img.setAttribute('style', 'float: left; padding: 5px 10px 5px 7px;');
			div2.appendChild(img);
			span = document.createElement('span');
			span.setAttribute('style', 'font-size: 18px');
			span.textContent = 'Vocalia (iOS)';
			div2.appendChild(span);
			div.appendChild(div2);
			chart.appendChild(div);
			
			div = document.createElement('div');
			div.setAttribute('id', 'appstore-panel');
			div.setAttribute('class', 'appstore-panel');
			div2 = document.createElement('div');
			div2.setAttribute('class', 'recognizer-panel-button');
			div2.setAttribute('title', 'Opens in a new tab/window');
			div2.setAttribute('onclick', 'javascript: voiceUtils.toAppStore("tasker")');
			img = document.createElement('img');
			img.setAttribute('src', 'popovers/assets/android.png');
			img.setAttribute('style', 'width: 135px;');
			div2.appendChild(img);
			div.appendChild(div2);
			div2 = document.createElement('div');
			div2.setAttribute('class', 'recognizer-panel-button');
			div2.setAttribute('title', 'Opens in a new tab/window');
			div2.setAttribute('style', 'padding-top: 8px');
			div2.setAttribute('onclick', 'javascript: voiceUtils.toAppStore("vocalia")');
			img = document.createElement('img');
			img.setAttribute('src', 'popovers/assets/apple.png');
			img.setAttribute('style', 'width: 135px;');
			div2.appendChild(img);
			div.appendChild(div2);
			chart.appendChild(div);

			img = document.createElement('img');
			img.setAttribute('id', 'download');
			img.setAttribute('class', 'download');
			img.setAttribute('src', 'popovers/assets/download.svg');
			img.setAttribute('onclick', 'javascript:exportVoiceCommands()');
			chart.appendChild(img);
		}
  },
  removeRecognizers : function() {
    var chart = document.getElementById('chart');
    chart.removeChild(document.getElementById('voice-instructions-3'));
    chart.removeChild(document.getElementById('button-panel'));
    chart.removeChild(document.getElementById('appstore-panel'));
    chart.removeChild(document.getElementById('download'));
  },
  toggleRecognizerChoice : function(recognizer) {
    document.getElementById('voice-instructions-3').style.color = '#fff';
    if (recognizer === 'tasker') {
      document.getElementById('vocalia').style.backgroundColor = '#333';
      document.getElementById('tasker').style.backgroundColor = '#f17440';
      voiceEntries.recognizer = 'tasker';
    } else {
      document.getElementById('tasker').style.backgroundColor = '#333';
      document.getElementById('vocalia').style.backgroundColor = '#f17440';
      voiceEntries.recognizer = 'vocalia';
    }
    voiceUtils.saveVoiceEntries();
  },
  toAppStore : function(recognizer) {
    var url = (recognizer === 'tasker') ? 'https://play.google.com/store/apps/details?id=net.dinglisch.android.taskerm' :
    'https://itunes.apple.com/us/app/vocalia/id291683886?mt=8';
    window.open(url, '_blank');
  },
  loadPositions: function() {
    for (var i = 0; i < this.categories.length; i++ ) {
      this.categories[i].top  = parseInt(getComputedStyle(document.getElementById(this.categories[i].name + '-voice')).top,  10);
      this.categories[i].left = parseInt(getComputedStyle(document.getElementById(this.categories[i].name + '-voice')).left, 10);
    }
  },
  findActiveCategories: function() {
    var device, deviceType, stewardID, storedEntries;

    list_task(ws2, '', { depth: 'all' }, function(message) {
      var uuidprefix = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

      var taskID, tasks;

      if ((!message.result) && (!message.error)) return false;
      if ((!message.result) || (!message.result.tasks)) throw new Error('tasks listing failed');
      
      tasks = {};
      for (taskID in message.result.tasks) {
        if ((message.result.tasks.hasOwnProperty(taskID))
              && (!uuidprefix.test(message.result.tasks[taskID].uuid))
              && (message.result.tasks[taskID].perform !== 'growl')) tasks[taskID] = message.result.tasks[taskID];
      }

      list_actors(ws2, '', { depth: 'all' }, function(message) {
        var actors, deviceID, devices, deviceType, entry, groupID, groups, stewardID, taskID;

        if ((!message.result) && (!message.error)) return false;
        if ((!message.result) || (!message.result.actors)) throw new Error('actor listing failed');

        stewardID = message.result['/place']['place/1'].info.identity;

        if (localStorage) storedEntries = JSON.parse(localStorage.getItem('voiceEntries' + stewardID));

        actors = {};
        for (deviceType in message.result) {
          if ((!message.result.hasOwnProperty(deviceType))
                || ((deviceType.indexOf('/device/') !== 0) && (deviceType.indexOf('/place/') !== 0))) continue;

          devices = message.result[deviceType];
          for (deviceID in devices) if (devices.hasOwnProperty(deviceID)) {
            entry = devices[deviceID];
            entry.whatami = deviceType;
            entry.whoami = deviceID;
            actors[entry.whoami] = entry;
            activateIcon(deviceType);
          }
        }

        groups = {};
        for (groupID in message.result['/group']) {
          if ((!message.result['/group'].hasOwnProperty(groupID))
                || (message.result['/group'][groupID].type !== 'task')
                || (uuidprefix.test(message.result['/group'][groupID].uuid))) continue;
          groups[groupID] = message.result['/group'][groupID];

          for (taskID in tasks) {
            if ((tasks.hasOwnProperty(taskID)) && (groups[groupID].members.indexOf(taskID) !== -1)) delete(tasks[taskID]);
          }
        }

        buildVoiceEntries(actors, groups, tasks, storedEntries, stewardID);
      });
    });
    
    function activateIcon(deviceType) {
      var cat, cats, j, name, q, quad;
      quad = deviceType.split('/');
      q = quad[2] + '_' + quad[4];
      name = voiceUtils.findCategory(q);
      cats = voiceUtils.categories;
      for (j = 0; j < cats.length; j++) {
        cat = cats[j];
        if (cat.name === name && cat.q.join('|').indexOf(q) != -1) {
          cat.active = (cat.name === name);
          document.getElementById(cat.name + '-voice').style.opacity = (cat.active) ? 1.0 : 0.3;
          return;
        }
      }
    }
  },
  saveVoiceEntries: function() {
    localStorage.setItem('voiceEntries' + voiceEntries.stewardID, JSON.stringify(voiceEntries));
  },
  setPhraseSelected: function(cluster, id, cmd, event) {
    var entry, i, lookup;
    for (i = 0; i < voiceEntries[cluster].length; i++) {
      entry = voiceEntries[cluster][i];
      lookup = { devices : entry.entry.whoami, categories : entry.q, groups : entry.entry.uuid, tasks : entry.entry.uuid }[cluster];
      if (id === lookup) {
        voiceEntries[cluster][i].phrases[cmd].selected = event.target.checked;
        voiceUtils.saveVoiceEntries();
        return;
      }
    }
  },
  setPhraseText: function(cluster, id, cmd, event) {
    var elem, entry, i, lookup;
    elem = event.target;
    if (event.keyCode) {
      if (event.keyCode !== 13) {
        return true;
      } else {
        event.preventDefault();
      }
    }
    for (i = 0; i < voiceEntries[cluster].length; i++) {
      entry = voiceEntries[cluster][i];
      lookup = { devices : entry.entry.whoami, categories : entry.q, groups : entry.entry.uuid, tasks : entry.entry.uuid }[cluster];
      if (id === lookup) {
        if (elem.textContent === '' || elem.textContent === '\n') {
          elem.textContent = voiceEntries[cluster][i].phrases[cmd].text;
          return;
        }
        voiceEntries[cluster][i].phrases[cmd].text = elem.textContent;
        voiceUtils.saveVoiceEntries();
        return;
      }
    }
  }
}

var buildVoiceEntries = function(actors, groups, tasks, storedEntries, stewardID) {
  var actor, catName, catObj, catObjCatalog, deviceObj, entry, group, groupObj, i, newEntries, q, quad, task, taskObj;
  
  newEntries = { actors : actors, devices : [], categories : [], groups : [], tasks : [] };
  if (!storedEntries) {
    voiceEntries.stewardID = stewardID;
    voiceEntries.actors = actors;
    voiceEntries.groups = [];
    voiceEntries.tasks = [];
    voiceEntries.devices = [];
    voiceEntries.categories = [];
  }
  catObjCatalog = {};
  
  for (actor in actors) if (actors.hasOwnProperty(actor)) {
    entry = actors[actor];
    quad = entry.whatami.split('/');
    q = quad[2] + '_' + quad[4];
    catName = voiceUtils.findCategory(q);
    deviceObj = {
                 entry      : entry
                 , q        : q
                 , phrases  : buildDevicePhrases(entry, q)
                 , selected : true
                 , category : catName
                 , sort     : entry.name
                };
    newEntries.devices.push(deviceObj);
    
    if (!catObjCatalog.hasOwnProperty(q) && voiceUtils.findCategory(q)) {
      catObj = {
                 entry      : entry
                 , q        : q
                 , phrases  : buildCategoryPhrases(entry, q)
                 , selected : true
                 , category : catName
                 , sort     : '!!!'
                };
      newEntries.categories.push(catObj);
      catObjCatalog[q] = catObj;
    }
  }
  catObjCatalog = {};
  
  for (group in groups) if (groups.hasOwnProperty(group)) {
    entry = groups[group];
    catName = 'groups';
    groupObj = {
                 entry      : entry
                 , phrases  : buildGroupTaskPhrases(entry)
                 , selected : true
                 , category : catName
                 , sort     : entry.name
                };
    newEntries.groups.push(groupObj);
  }
  
  for (task in tasks) if (tasks.hasOwnProperty(task)) {
    entry = tasks[task];
    catName = 'tasks';
    taskObj = {
                 entry      : entry
                 , phrases  : buildGroupTaskPhrases(entry)
                 , selected : true
                 , category : catName
                 , sort     : entry.name
                };
    newEntries.tasks.push(taskObj);
  }
  
  if (storedEntries) {
    reconcile(newEntries, storedEntries)
  } else {
    voiceEntries.devices = newEntries.devices;
    voiceEntries.categories = newEntries.categories;
    voiceEntries.groups = newEntries.groups || [];
    voiceEntries.tasks = newEntries.tasks || [];
  }
  voiceUtils.saveVoiceEntries();
//  console.log(voiceEntries);
  
  function buildDevicePhrases(entry, q) {
    return voiceUtils.defaultDevicePhrases(entry, q);
  }
  
  function buildCategoryPhrases(entry, q) {
    return voiceUtils.defaultCategoryPhrases(entry, q);
  }
  
  function buildGroupTaskPhrases(entry) {
    return { perform : { selected : true, text : entry.name } };
  }
  
  function reconcile(newEntries, storedEntries) {
    var cmd, devID, found, i, j, newItem, newName, oldItem, oldName, regexp;
    
    for (i = storedEntries.devices.length - 1; i >= 0; i--) {
      oldItem = storedEntries.devices[i];
      devID = oldItem.entry.whoami;
      oldName = oldItem.entry.name;
      found = false;
      
      for (j = newEntries.devices.length - 1; j >= 0; j--) {
        newItem = newEntries.devices[j];
        if (devID === newItem.entry.whoami) {
          found = true;
          newName = newItem.entry.name;
          if (oldName !== newName) {
            oldItem.entry = newItem.entry;
            for (cmd in oldItem.phrases) {
              regexp = new RegExp('\\b' + oldName + '\\b', 'i');
              oldItem.phrases[cmd].text = oldItem.phrases[cmd].text.replace(regexp, newName);
            }
          }
          newEntries.devices.splice(j, 1);
          break;
        }
      }
      if (!found) storedEntries.devices.splice(i, 1);
    }
    if (newEntries.devices.length > 0) storedEntries.devices = storedEntries.devices.concat(newEntries.devices);
    
    for (i = storedEntries.categories.length - 1; i >= 0; i--) {
      oldItem = storedEntries.categories[i];
      found = false;
      
      for (j = newEntries.categories.length - 1; j >= 0; j--) {
        newItem = newEntries.categories[j];
        if (oldItem.category === newItem.category && oldItem.q === newItem.q) {
          found = true;
          newEntries.categories.splice(j, 1);
          break;
        }
      }
      if (!found) storedEntries.categories.splice(i, 1);
    }
    if (newEntries.categories.length > 0) storedEntries.categories = storedEntries.categories.concat(newEntries.categories);
    
    for (i = storedEntries.groups.length - 1; i >= 0; i--) {
      oldItem = storedEntries.groups[i];
      found = false;
      
      for (j = newEntries.groups.length - 1; j >= 0; j--) {
        newItem = newEntries.groups[j];
        if (oldItem.entry.uuid === newItem.entry.uuid) {
          found = true;
          newEntries.groups.splice(j, 1);
          break;
        }
      }
      if (!found) storedEntries.groups.splice(i, 1);
    }
    if (newEntries.groups.length > 0) storedEntries.groups = storedEntries.groups.concat(newEntries.groups);
        
    for (i = storedEntries.tasks.length - 1; i >= 0; i--) {
      oldItem = storedEntries.tasks[i];
      found = false;
      
      for (j = newEntries.tasks.length - 1; j >= 0; j--) {
        newItem = newEntries.tasks[j];
        if (oldItem.entry.uuid === newItem.entry.uuid) {
          found = true;
          newEntries.tasks.splice(j, 1);
          break;
        }
      }
      if (!found) storedEntries.tasks.splice(i, 1);
    }
    if (newEntries.tasks.length > 0) storedEntries.tasks = storedEntries.tasks.concat(newEntries.tasks);

    voiceEntries = storedEntries;
    voiceUtils.saveVoiceEntries();
  }
}

var handlePhraseArrow = function(evt) {
  var topEnd, tray, startTop;
  var viewPortHeight = parseInt(document.getElementById('enumerations-viewport').style.height,  10);
  
  tray = d3.select("#enumerations-tray");
  startTop = parseInt(tray.style("top"), 10);
  topEnd = ((evt.target.id === 'phrase-down-arrow') ? (startTop - viewPortHeight) : (startTop + viewPortHeight));
  
  var transition = d3.transition()
    .duration(3000)
    .ease("linear");
	tray.transition().each("end", function() {
		handleArrowVisibility();
	})
    .style("top", function() {return topEnd + 'px';});
    
  function handleArrowVisibility() {
    var trayHeight = parseInt(tray.style('height'), 10); //parseInt(document.getElementById("image-tray").style.width, 10);
    var trayTop = parseInt(tray.style('top'), 10); // parseInt(document.getElementById("image-tray").style.left, 10);
    var trayPage = Math.abs(trayTop / viewPortHeight);
    
    if (trayTop >= 0) {
  		document.getElementById("phrase-up-arrow").style.display = "none";
    } else {
  		document.getElementById("phrase-up-arrow").style.display = "block";
    }
    if (trayHeight + trayTop <= viewPortHeight) {
  		document.getElementById("phrase-down-arrow").style.display = "none";
    } else {
  		document.getElementById("phrase-down-arrow").style.display = "block";
    }
  }
}

