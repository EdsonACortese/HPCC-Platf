#include "jexcept.hpp"
#include "xslprocessor.hpp"
#include "xmlvalidator.hpp"
#include "xmlerror.hpp"
#include "xpathprocessor.hpp"

XMLLIB_API IXmlDomParser* getXmlDomParser()
{
    throw MakeStringException(XMLERR_MissingDependency, "XML validation library unavailable");
}

extern IXslProcessor* getXslProcessor()
{
    throw MakeStringException(XMLERR_MissingDependency, "XSLT library unavailable");
}

extern ICompiledXpath* getCompiledXpath(const char * xpath)
{
    throw MakeStringException(XMLERR_MissingDependency, "XSLT library unavailable");
}

extern IXpathContext* getXpathContext(const char * xmldoc)
{
    throw MakeStringException(XMLERR_MissingDependency, "XSLT library unavailable");
}

extern ICompiledXpath* compileOptionalXpath(const char * xpath)
{
    UNIMPLEMENTED;
}

extern ICompiledXpath* compileXpath(const char * xpath)
{
    UNIMPLEMENTED;
}

ISectionalXmlDocModel *createSectionalXmlDocModel(void * userData)
{
    UNIMPLEMENTED;
}

