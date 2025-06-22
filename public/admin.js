document.getElementById('form').addEventListener('submit', async function(e){
  e.preventDefault();
  const input = document.getElementById('msg');
  const chat = document.getElementById('chat');
  const text = input.value.trim();
  if(!text) return;
  appendMessage(text,'user');
  input.value='';
  const loading = document.createElement('div');
  loading.className='message ai loading';
  loading.textContent='...';
  chat.appendChild(loading);
  chat.scrollTop = chat.scrollHeight;
  try{
    const res = await fetch('/chat',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:text})
    });
    const data = await res.json();
    chat.removeChild(loading);
    if(data.reply){
      appendAiMessage(data.reply, data.changes, data.diff);
    }else if(data.error){
      appendMessage('Error: '+data.error,'ai');
    }else{
      appendMessage('Error','ai');
    }
  }catch(err){
    chat.removeChild(loading);
    appendMessage('Error','ai');
  }
});

function appendMessage(text,cls){
  const chat = document.getElementById('chat');
  const div = document.createElement('div');
  div.className='message '+cls;
  div.textContent=text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function appendAiMessage(text,changes,diff){
  const chat = document.getElementById('chat');
  const div = document.createElement('div');
  div.className='message ai';
  if(diff && diff.length){
    div.appendChild(renderDiff(diff));
  }else{
    const msgSpan = document.createElement('div');
    msgSpan.textContent=text;
    div.appendChild(msgSpan);
    if(changes){
      const pre = document.createElement('pre');
      pre.textContent=JSON.stringify(changes,null,2);
      div.appendChild(pre);
    }
  }
  if(changes){
    const btnWrap=document.createElement('div');
    btnWrap.className='approval-buttons';
    const yes=document.createElement('button');
    yes.textContent='Yes';
    const no=document.createElement('button');
    no.textContent='No';
    btnWrap.appendChild(yes);
    btnWrap.appendChild(no);
    div.appendChild(btnWrap);
    yes.addEventListener('click',async()=>{
      btnWrap.textContent='Applying...';
      try{
        const res=await fetch('/apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({changes})});
        if(res.ok){btnWrap.textContent='Applied';}else{btnWrap.textContent='Failed';}
      }catch(e){btnWrap.textContent='Failed';}
    });
    no.addEventListener('click',()=>{btnWrap.textContent='Cancelled';});
  }
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function renderDiff(diff){
  const pre=document.createElement('pre');
  pre.className='diff';
  diff.forEach(mod=>{
    const modLine=document.createElement('div');
    modLine.textContent=mod.module+':';
    pre.appendChild(modLine);
    mod.changes.forEach(c=>{
      const rem=document.createElement('div');
      rem.className='diff-remove';
      rem.textContent=`- ${c.key}: ${JSON.stringify(c.before)}`;
      pre.appendChild(rem);
      const add=document.createElement('div');
      add.className='diff-add';
      add.textContent=`+ ${c.key}: ${JSON.stringify(c.after)}`;
      pre.appendChild(add);
    });
  });
  return pre;
}
