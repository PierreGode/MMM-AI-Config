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
      appendMessage(data.reply,'ai');
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
