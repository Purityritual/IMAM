const button=document.getElementById("language");
button.addEventListener("click",()=>{
  const root=document.documentElement;
  const english=root.lang!=="en";
  root.lang=english?"en":"ar";
  root.dir=english?"ltr":"rtl";
  document.querySelectorAll("[data-ar]").forEach(el=>el.textContent=el.dataset[english?"en":"ar"]);
  button.textContent=english?"ع":"EN";
  document.title=english?"Purity Ritual | The Art of Clean & Care":"Purity Ritual | فن النظافة والعناية";
});
