$(function() {
  var serializeForm = function(form) {
    var data = {}
    $(form).serializeArray().forEach(function(item) { data[item.name] = item.value })
    return data
  }
  var parseUrl = function(search) {
    var qs = {}
    search.substr(1).split("&").forEach(function(pair) {
      if(pair === "") return;
      var parts = pair.split('=');
      qs[parts[0]] = parts[1] && decodeURIComponent(parts[1].replace(/\+/g," "));
    })
    return qs;
  }
  var populate = function(frm, data) {
    $.each(data, function(key, value) {
      var ctrl = $('[name='+key+']', frm);
      switch(ctrl.prop("type")) {
        case "radio": case "checkbox":
          ctrl.each(function() {
              if($(this).attr('value') == value) $(this).attr("checked",value);
          });
          break;
        default:
          ctrl.val(value);
      }
    });  
  }

  var initdata = parseUrl(window.location.search);
  var form = document.forms[0];

  populate(form, initdata);

  window.GoParamUrl = function() {
    window.location = window.location.origin + "?" + $.param(serializeForm(form));
  };
});
