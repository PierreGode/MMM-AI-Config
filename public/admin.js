document.getElementById('form').addEventListener('submit', async function(e){
  e.preventDefault();
  const input = document.getElementById('msg');
  const chat = document.getElementById('chat');
  const text = input.value.trim();
  if(!text) return;
  chat.innerHTML += `<div class="user">${text}</div>`;
  input.value='';
  const res = await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text})});
  let data = await res.json();
  if(data.reply){
    chat.innerHTML += `<div class="ai">${data.reply}</div>`;
  }else if(data.error){
    chat.innerHTML += `<div class="ai">Error: ${data.error}</div>`;
  }else{
    chat.innerHTML += `<div class="ai">Error</div>`;
  }
  chat.scrollTop = chat.scrollHeight;
});
