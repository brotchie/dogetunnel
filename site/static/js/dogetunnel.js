/* Disable <enter> key */
$(document).ready(function() {
    $(window).keydown(function(event) {
        if (event.keyCode == 13) {
            event.preventDefault();
            return false;
        }
    });
});


var public_address, password;

$("#wizard").steps({
  headerTag: "h3",
  bodyTag: "section",
  titleTemplate: "#title#",
  forceMoveForward: true,
  transitionEffect: "slideLeft",
  enableFinishButton: false,
  onStepChanging: function(event, currentIndex, newIndex) {
    if (currentIndex == 1) {
      $("#form1").validate({
        errorPlacement: function(error, element) {
          return true;
        },
        rules: {
          confirm: {
            equalTo: "#password"
          }
        }
      });
      if ($("#form1").valid()) {
        password = $("#password").val();
        $.ajax({
          url: "/account",
          type: "POST",
          dataType: "json",
          data: JSON.stringify({
            password: password
          }),
          contentType: "application/json; charset=utf-8",
          success: function(data) {
            public_address = data.public_address;
            $("#public_key").html(public_address);
          }
        });
      } else {
        return false;
      }
    } else if (currentIndex == 2) {
      if ($("#form2").valid()) {
        $.ajax({
          url: "/account/" + public_address + "/email",
          type: "PUT",
          dataType: "json",
          data: JSON.stringify({
            password: password,
            email: $("#email").val()
          }),
          contentType: "application/json; charset=utf-8",
          success: function(data) {
            console.log(data);
          }
        });
      } else {
        return false;
      }
    }
    return true;
  },
  onFinishing: function(event, currentIndex) {},
  onFinished: function(event, currentIndex) {}
});

