function include(filename) {
  return HtmlService
    .createHtmlOutputFromFile(filename)
    .getContent();
}

function getAppClientControllerSource() {
  return createAppClientController.toString();
}

function getAppRendererSource() {
  return createAppRenderer.toString();
}

function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Liceo del Valle - Futbol');
}

if (typeof module !== 'undefined') {
  module.exports = {
    doGet: doGet,
    getAppClientControllerSource: getAppClientControllerSource,
    getAppRendererSource: getAppRendererSource,
    include: include
  };
}
