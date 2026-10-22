(() => {
  'use strict';
  // Solo expresiones sociales completas; las consultas de contenido siguen en el agente.
  function classify(text, stage = '') {
    const value = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[¿?¡!.,;:]/g, '').replace(/\s+/g, ' ').trim();
    if (stage === 'answer' && /^(si|si me ayudo|si fue util)$/.test(value)) return 'feedback_helpful';
    if (stage === 'answer' && /^(no|no me ayudo|no fue util)$/.test(value)) return 'feedback_unhelpful';
    if (/^(hola|buenos dias|buenas tardes|buenas noches|buenas)$/.test(value)) return 'greeting';
    if (/^(quien eres|que eres|eres (?:un|una) (?:robot|bot|persona|asistente virtual)|que puedes hacer)$/.test(value)) return 'identity';
    if (/^(?:quiero |necesito |quisiera |deseo |puedo |como puedo |me gustaria )?(?:hablar|conversar|comunicarme|contactar)(?: con| a)? (?:un |una |algun |alguna )?(?:humano|humana|persona|ejecutivo|ejecutiva|funcionario|funcionaria|operador|operadora|agente humano)$/.test(value) || /^(atencion humana|hablar con un humano|contacto|telefono de contacto|correo de contacto)$/.test(value)) return 'human_help';
    if (/^(?:no me (?:ayudo|sirvio)|no (?:resolvio|responde a) mi (?:consulta|pregunta)|la respuesta no (?:me ayuda|es util))$/.test(value)) return 'assistance';
    if (/^(?:muchas )?gracias(?: por (?:la ayuda|la informacion))?(?: eso (?:es|seria) todo)?$/.test(value) || /^(eso (?:es|seria) todo|me (?:ayudo|sirvio))$/.test(value)) return 'resolved';
    if (/^(adios|chao|hasta luego|finalizar(?: conversacion)?|cerrar(?: (?:el )?chat| conversacion)?)$/.test(value)) return 'end_confirm';
    return '';
  }
  window.MBNChatConversation = {classify};
})();
